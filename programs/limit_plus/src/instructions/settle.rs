use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::errors::LimitPlusError;
use crate::events::Settled;
use crate::math;
use crate::oracle;
use crate::state::*;

#[derive(Accounts)]
pub struct Settle<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(address = round.quote_mint @ LimitPlusError::WrongMint)]
    pub quote_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: validated inside `oracle::read_price` (owner, discriminator, feed id).
    pub price_account: UncheckedAccount<'info>,
}

pub fn settle_handler(ctx: Context<Settle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.require_state(&[RoundState::Cleared])?;
    require!(!round.settled, LimitPlusError::WrongPhase);
    require!(now >= round.expiry_ts, LimitPlusError::TooEarly);

    let p = oracle::read_price(&ctx.accounts.price_account.to_account_info(), &round.pyth_feed_id)?;
    let drift = p.publish_time.checked_sub(round.expiry_ts).ok_or(LimitPlusError::MathOverflow)?.unsigned_abs();
    require!(drift <= round.settle_tolerance_secs as u64, LimitPlusError::OracleOutsideWindow);
    require!(p.price > 0, LimitPlusError::OracleInvalidPrice);
    require!(
        math::confidence_ok(p.price, p.conf, ctx.accounts.config.max_conf_bps)?,
        LimitPlusError::OracleConfidenceTooWide
    );

    let per_contract =
        math::settle_price_per_contract(p.price, p.expo, ctx.accounts.quote_mint.decimals, round.shares_per_contract_e9)?;
    let itm = math::is_in_the_money(round.side, per_contract, round.strike_per_contract);
    round.settle_price_per_contract = per_contract;
    round.settle_publish_time = p.publish_time;
    round.in_the_money = itm;
    round.settled = true;
    round.advance(RoundState::Settled)?;
    emit!(Settled { round: round.key(), price_per_contract: per_contract, publish_time: p.publish_time, in_the_money: itm });
    Ok(())
}

use anchor_lang::prelude::*;

use crate::errors::LimitPlusError;
use crate::events::Settled;
use crate::state::*;

#[derive(Accounts)]
pub struct ExpireWithoutPrice<'info> {
    pub cranker: Signer<'info>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
}

pub fn expire_without_price_handler(ctx: Context<ExpireWithoutPrice>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.require_state(&[RoundState::Cleared])?;
    require!(!round.settled, LimitPlusError::WrongPhase);
    let deadline = round.expiry_ts.checked_add(round.settle_grace_secs).ok_or(LimitPlusError::MathOverflow)?;
    require!(now >= deadline, LimitPlusError::TooEarly);
    round.in_the_money = false;
    round.settled = true;
    round.advance(RoundState::Settled)?;
    emit!(Settled { round: round.key(), price_per_contract: 0, publish_time: 0, in_the_money: false });
    Ok(())
}

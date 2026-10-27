use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::errors::LimitPlusError;
use crate::events::Finalized;
use crate::state::*;

#[derive(Accounts)]
pub struct Finalize<'info> {
    pub cranker: Signer<'info>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(seeds = [VAULT_SEED, round.key().as_ref(), VAULT_QUOTE], bump)]
    pub quote_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(seeds = [VAULT_SEED, round.key().as_ref(), VAULT_UNDERLYING], bump)]
    pub underlying_vault: InterfaceAccount<'info, TokenAccount>,
}

pub fn finalize_handler(ctx: Context<Finalize>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.require_state(&[RoundState::Settled])?;
    let window_end = round.expiry_ts.checked_add(round.exercise_window_secs).ok_or(LimitPlusError::MathOverflow)?;
    let ready = now >= window_end || !round.in_the_money || round.exercised_contracts == round.sold_contracts;
    require!(ready, LimitPlusError::TooEarly);
    round.final_quote = ctx.accounts.quote_vault.amount;
    round.final_underlying = ctx.accounts.underlying_vault.amount;
    round.advance(RoundState::Finalized)?;
    emit!(Finalized { round: round.key(), final_quote: round.final_quote, final_underlying: round.final_underlying });
    Ok(())
}

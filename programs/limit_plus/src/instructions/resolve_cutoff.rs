use anchor_lang::prelude::*;

use crate::errors::LimitPlusError;
use crate::events::CutoffResolved;
use crate::randomness;
use crate::state::*;

#[derive(Accounts)]
pub struct ResolveCutoff<'info> {
    pub cranker: Signer<'info>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    /// CHECK: address-constrained to the SlotHashes sysvar; raw bytes are read, never deserialized whole.
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

pub fn resolve_cutoff_handler(ctx: Context<ResolveCutoff>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.require_state(&[RoundState::Deposit])?;
    require!(!round.cutoff_resolved, LimitPlusError::WrongPhase);
    require!(now >= round.bid_end_ts, LimitPlusError::TooEarly);

    let data = ctx.accounts.slot_hashes.try_borrow_data()?;
    let cutoff = randomness::derive_cutoff(&data, &round.key(), round.candle_start_ts, round.bid_end_ts)?;
    round.cutoff_ts = cutoff;
    round.cutoff_resolved = true;
    round.advance(RoundState::Reveal)?;
    emit!(CutoffResolved { round: round.key(), cutoff_ts: cutoff });
    Ok(())
}

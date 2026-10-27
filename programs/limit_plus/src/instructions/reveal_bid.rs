use anchor_lang::prelude::*;

use crate::errors::LimitPlusError;
use crate::events::BidRevealed;
use crate::math;
use crate::state::*;

#[derive(Accounts)]
pub struct RevealBid<'info> {
    pub bidder: Signer<'info>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut, seeds = [BID_SEED, round.key().as_ref(), bidder.key().as_ref()], bump = bid.bump,
        has_one = bidder @ LimitPlusError::Unauthorized
    )]
    pub bid: Account<'info, Bid>,
}

pub fn reveal_bid_handler(ctx: Context<RevealBid>, price_per_contract: u64, qty: u64, salt: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.require_reveal_window(now)?;
    let bid = &mut ctx.accounts.bid;
    require!(!bid.revealed, LimitPlusError::AlreadyRevealed);

    let h = math::commitment_hash(&round.key(), &bid.bidder, price_per_contract, qty, &salt);
    require!(h == bid.commitment, LimitPlusError::CommitmentMismatch);

    bid.revealed = true;
    bid.price_per_contract = price_per_contract;
    bid.qty = qty;
    bid.valid = bid.commit_ts <= round.cutoff_ts
        && price_per_contract >= round.reserve_premium_per_contract
        && qty >= 1
        && math::bid_cost_within_escrow(price_per_contract, qty, bid.escrow);
    round.revealed_count = round.revealed_count.checked_add(1).ok_or(LimitPlusError::MathOverflow)?;
    emit!(BidRevealed { round: round.key(), bidder: bid.bidder, valid: bid.valid });
    Ok(())
}

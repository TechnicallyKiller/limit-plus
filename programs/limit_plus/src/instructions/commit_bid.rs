use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::BidCommitted;
use crate::state::*;
use crate::token::transfer_user;

#[derive(Accounts)]
pub struct CommitBid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        init, payer = bidder, space = 8 + Bid::INIT_SPACE,
        seeds = [BID_SEED, round.key().as_ref(), bidder.key().as_ref()], bump
    )]
    pub bid: Account<'info, Bid>,
    #[account(address = round.quote_mint @ LimitPlusError::WrongMint)]
    pub quote_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = quote_mint, token::authority = bidder, token::token_program = token_program)]
    pub bidder_quote: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_ESCROW], bump,
        token::mint = quote_mint, token::token_program = token_program
    )]
    pub escrow_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(address = round.quote_token_program)]
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn commit_bid_handler(ctx: Context<CommitBid>, commitment: [u8; 32], escrow: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, LimitPlusError::Paused);
    require!(escrow > 0, LimitPlusError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.require_bidding_window(now)?;
    require!(round.bid_count < MAX_BIDS_PER_ROUND, LimitPlusError::TooManyBids);
    round.bid_count += 1;

    let b = &mut ctx.accounts.bid;
    b.bump = ctx.bumps.bid;
    b.round = round.key();
    b.bidder = ctx.accounts.bidder.key();
    b.commitment = commitment;
    b.escrow = escrow;
    b.commit_ts = now;

    transfer_user(
        &ctx.accounts.token_program,
        &ctx.accounts.bidder_quote,
        &ctx.accounts.quote_mint,
        &ctx.accounts.escrow_vault,
        &ctx.accounts.bidder.to_account_info(),
        escrow,
    )?;
    emit!(BidCommitted { round: round.key(), bidder: b.bidder, escrow });
    Ok(())
}

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::Refunded;
use crate::math;
use crate::state::*;
use crate::token::transfer_vault;

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    pub bidder: Signer<'info>,
    #[account(
        seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut, seeds = [BID_SEED, round.key().as_ref(), bidder.key().as_ref()], bump = bid.bump,
        has_one = bidder @ LimitPlusError::Unauthorized
    )]
    pub bid: Account<'info, Bid>,
    #[account(address = round.quote_mint @ LimitPlusError::WrongMint)]
    pub quote_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_ESCROW], bump, token::mint = quote_mint)]
    pub escrow_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = quote_mint, token::authority = bidder, token::token_program = token_program)]
    pub bidder_quote: InterfaceAccount<'info, TokenAccount>,
    #[account(address = round.quote_token_program)]
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn claim_refund_handler(ctx: Context<ClaimRefund>) -> Result<()> {
    let round = &ctx.accounts.round;
    require!(round.is_post_clear(), LimitPlusError::WrongPhase);
    let bid = &mut ctx.accounts.bid;
    require!(!bid.refunded, LimitPlusError::AlreadyRefunded);
    bid.refunded = true;
    let amount = math::sub_u64(bid.escrow, bid.paid)?;

    crate::round_signer!(round => seeds);
    transfer_vault(
        &ctx.accounts.token_program,
        &ctx.accounts.escrow_vault,
        &ctx.accounts.quote_mint,
        &ctx.accounts.bidder_quote,
        &round.to_account_info(),
        &seeds,
        amount,
    )?;
    emit!(Refunded { round: round.key(), bidder: bid.bidder, amount });
    Ok(())
}

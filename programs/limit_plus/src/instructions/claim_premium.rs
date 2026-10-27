use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::PremiumClaimed;
use crate::math;
use crate::state::*;
use crate::token::transfer_vault;

#[derive(Accounts)]
pub struct ClaimPremium<'info> {
    pub owner: Signer<'info>,
    #[account(
        seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut, seeds = [POSITION_SEED, round.key().as_ref(), owner.key().as_ref()], bump = position.bump,
        has_one = owner @ LimitPlusError::Unauthorized
    )]
    pub position: Account<'info, Position>,
    #[account(address = round.quote_mint @ LimitPlusError::WrongMint)]
    pub quote_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_PREMIUM], bump, token::mint = quote_mint)]
    pub premium_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = quote_mint, token::authority = owner, token::token_program = token_program)]
    pub user_quote: InterfaceAccount<'info, TokenAccount>,
    #[account(address = round.quote_token_program)]
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn claim_premium_handler(ctx: Context<ClaimPremium>) -> Result<()> {
    let round = &ctx.accounts.round;
    require!(
        matches!(round.state, RoundState::Cleared | RoundState::Settled | RoundState::Finalized),
        LimitPlusError::WrongPhase
    );
    let pos = &mut ctx.accounts.position;
    require!(!pos.premium_claimed, LimitPlusError::AlreadyClaimed);
    pos.premium_claimed = true;
    let amount = math::pro_rata(round.premium_to_users, pos.contracts, round.total_contracts)?;

    crate::round_signer!(round => seeds);
    transfer_vault(
        &ctx.accounts.token_program,
        &ctx.accounts.premium_vault,
        &ctx.accounts.quote_mint,
        &ctx.accounts.user_quote,
        &round.to_account_info(),
        &seeds,
        amount,
    )?;
    emit!(PremiumClaimed { round: round.key(), owner: pos.owner, amount });
    Ok(())
}

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::{Claimed, PremiumClaimed};
use crate::math;
use crate::state::*;
use crate::token::transfer_vault;

#[derive(Accounts)]
pub struct Claim<'info> {
    pub owner: Signer<'info>,
    #[account(
        seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Box<Account<'info, Round>>,
    #[account(
        mut, seeds = [POSITION_SEED, round.key().as_ref(), owner.key().as_ref()], bump = position.bump,
        has_one = owner @ LimitPlusError::Unauthorized
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(address = round.quote_mint @ LimitPlusError::WrongMint)]
    pub quote_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(address = round.underlying_mint @ LimitPlusError::WrongMint)]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_QUOTE], bump, token::mint = quote_mint)]
    pub quote_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_UNDERLYING], bump, token::mint = underlying_mint)]
    pub underlying_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_PREMIUM], bump, token::mint = quote_mint)]
    pub premium_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = quote_mint, token::authority = owner, token::token_program = quote_token_program)]
    pub user_quote: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = underlying_mint, token::authority = owner, token::token_program = underlying_token_program)]
    pub user_underlying: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = round.quote_token_program)]
    pub quote_token_program: Interface<'info, TokenInterface>,
    #[account(address = round.underlying_token_program)]
    pub underlying_token_program: Interface<'info, TokenInterface>,
}

pub fn claim_handler(ctx: Context<Claim>) -> Result<()> {
    let round = &ctx.accounts.round;
    round.require_state(&[RoundState::Finalized, RoundState::NoSale])?;
    let pos = &mut ctx.accounts.position;
    require!(!pos.claimed, LimitPlusError::AlreadyClaimed);
    pos.claimed = true;

    let quote = math::pro_rata(round.final_quote, pos.contracts, round.total_contracts)?;
    let underlying = math::pro_rata(round.final_underlying, pos.contracts, round.total_contracts)?;
    let premium = if pos.premium_claimed {
        0
    } else {
        pos.premium_claimed = true;
        math::pro_rata(round.premium_to_users, pos.contracts, round.total_contracts)?
    };

    crate::round_signer!(round => seeds);
    let round_info = round.to_account_info();
    transfer_vault(&ctx.accounts.quote_token_program, &ctx.accounts.quote_vault, &ctx.accounts.quote_mint, &ctx.accounts.user_quote, &round_info, &seeds, quote)?;
    transfer_vault(&ctx.accounts.underlying_token_program, &ctx.accounts.underlying_vault, &ctx.accounts.underlying_mint, &ctx.accounts.user_underlying, &round_info, &seeds, underlying)?;
    transfer_vault(&ctx.accounts.quote_token_program, &ctx.accounts.premium_vault, &ctx.accounts.quote_mint, &ctx.accounts.user_quote, &round_info, &seeds, premium)?;
    if premium > 0 {
        emit!(PremiumClaimed { round: round.key(), owner: pos.owner, amount: premium });
    }
    emit!(Claimed { round: round.key(), owner: pos.owner, quote, underlying });
    Ok(())
}

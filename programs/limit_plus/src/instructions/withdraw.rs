use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::Withdrawn;
use crate::math;
use crate::state::*;
use crate::token::transfer_vault;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut, seeds = [POSITION_SEED, round.key().as_ref(), owner.key().as_ref()], bump = position.bump,
        has_one = owner @ LimitPlusError::Unauthorized
    )]
    pub position: Account<'info, Position>,
    #[account(address = round.collateral_mint() @ LimitPlusError::WrongMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = owner, token::token_program = token_program)]
    pub user_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut, seeds = [VAULT_SEED, round.key().as_ref(), round.collateral_seed()], bump,
        token::mint = mint, token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(address = round.collateral_token_program())]
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn withdraw_handler(ctx: Context<Withdraw>, contracts: u64) -> Result<()> {
    require!(contracts > 0, LimitPlusError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.round.require_deposit_window(now)?;
    let round = &mut ctx.accounts.round;
    let pos = &mut ctx.accounts.position;
    pos.contracts = math::sub_u64(pos.contracts, contracts)?;
    round.total_contracts = math::sub_u64(round.total_contracts, contracts)?;
    let amount = math::collateral_amount(round.side, contracts, round.strike_per_contract, round.contract_size_raw)?;

    crate::round_signer!(round => seeds);
    transfer_vault(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.user_token,
        &round.to_account_info(),
        &seeds,
        amount,
    )?;
    emit!(Withdrawn { round: round.key(), owner: ctx.accounts.owner.key(), contracts });
    Ok(())
}

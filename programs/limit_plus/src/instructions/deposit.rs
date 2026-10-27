use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::Deposited;
use crate::math;
use crate::state::*;
use crate::token::transfer_user;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        init_if_needed, payer = owner, space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, round.key().as_ref(), owner.key().as_ref()], bump
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
    pub system_program: Program<'info, System>,
}

pub fn deposit_handler(ctx: Context<Deposit>, contracts: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, LimitPlusError::Paused);
    require!(contracts > 0, LimitPlusError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.require_deposit_window(now)?;

    let amount = math::collateral_amount(round.side, contracts, round.strike_per_contract, round.contract_size_raw)?;
    let pos = &mut ctx.accounts.position;
    if pos.owner == Pubkey::default() {
        pos.bump = ctx.bumps.position;
        pos.round = round.key();
        pos.owner = ctx.accounts.owner.key();
        round.depositor_count = round.depositor_count.checked_add(1).ok_or(LimitPlusError::MathOverflow)?;
    }
    pos.contracts = math::add_u64(pos.contracts, contracts)?;
    round.total_contracts = math::add_u64(round.total_contracts, contracts)?;

    transfer_user(
        &ctx.accounts.token_program,
        &ctx.accounts.user_token,
        &ctx.accounts.mint,
        &ctx.accounts.vault,
        &ctx.accounts.owner.to_account_info(),
        amount,
    )?;
    emit!(Deposited { round: round.key(), owner: ctx.accounts.owner.key(), contracts });
    Ok(())
}

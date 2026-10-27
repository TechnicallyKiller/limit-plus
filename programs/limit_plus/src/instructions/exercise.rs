use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::Exercised;
use crate::math;
use crate::state::*;
use crate::token::{transfer_user, transfer_vault};

#[derive(Accounts)]
pub struct Exercise<'info> {
    pub bidder: Signer<'info>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Box<Account<'info, Round>>,
    #[account(
        mut, seeds = [BID_SEED, round.key().as_ref(), bidder.key().as_ref()], bump = bid.bump,
        has_one = bidder @ LimitPlusError::Unauthorized
    )]
    pub bid: Box<Account<'info, Bid>>,
    #[account(address = round.quote_mint @ LimitPlusError::WrongMint)]
    pub quote_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(address = round.underlying_mint @ LimitPlusError::WrongMint)]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_QUOTE], bump, token::mint = quote_mint)]
    pub quote_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_UNDERLYING], bump, token::mint = underlying_mint)]
    pub underlying_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = quote_mint, token::authority = bidder, token::token_program = quote_token_program)]
    pub bidder_quote: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = underlying_mint, token::authority = bidder, token::token_program = underlying_token_program)]
    pub bidder_underlying: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = round.quote_token_program)]
    pub quote_token_program: Interface<'info, TokenInterface>,
    #[account(address = round.underlying_token_program)]
    pub underlying_token_program: Interface<'info, TokenInterface>,
}

pub fn exercise_handler(ctx: Context<Exercise>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.require_state(&[RoundState::Settled, RoundState::Finalized])?;
    require!(round.in_the_money, LimitPlusError::NotInTheMoney);
    let deadline = round.expiry_ts.checked_add(round.exercise_window_secs).ok_or(LimitPlusError::MathOverflow)?;
    require!(now < deadline, LimitPlusError::ExerciseWindowClosed);
    let bid = &mut ctx.accounts.bid;
    require!(bid.won_qty > 0, LimitPlusError::NothingToExercise);
    require!(!bid.exercised, LimitPlusError::AlreadyExercised);
    bid.exercised = true;
    let qty = bid.won_qty;
    round.exercised_contracts = math::add_u64(round.exercised_contracts, qty)?;

    let underlying_amount = math::mul_u64(qty, round.contract_size_raw)?;
    let quote_amount = math::mul_u64(qty, round.strike_per_contract)?;
    let round_info = round.to_account_info();
    crate::round_signer!(round => seeds);
    match round.side {
        Side::BuyLower => {
            // Bidder sells the stock to the pool at the strike.
            transfer_user(
                &ctx.accounts.underlying_token_program,
                &ctx.accounts.bidder_underlying,
                &ctx.accounts.underlying_mint,
                &ctx.accounts.underlying_vault,
                &ctx.accounts.bidder.to_account_info(),
                underlying_amount,
            )?;
            transfer_vault(
                &ctx.accounts.quote_token_program,
                &ctx.accounts.quote_vault,
                &ctx.accounts.quote_mint,
                &ctx.accounts.bidder_quote,
                &round_info,
                &seeds,
                quote_amount,
            )?;
        }
        Side::SellHigher => {
            // Bidder buys the stock from the pool at the strike.
            transfer_user(
                &ctx.accounts.quote_token_program,
                &ctx.accounts.bidder_quote,
                &ctx.accounts.quote_mint,
                &ctx.accounts.quote_vault,
                &ctx.accounts.bidder.to_account_info(),
                quote_amount,
            )?;
            transfer_vault(
                &ctx.accounts.underlying_token_program,
                &ctx.accounts.underlying_vault,
                &ctx.accounts.underlying_mint,
                &ctx.accounts.bidder_underlying,
                &round_info,
                &seeds,
                underlying_amount,
            )?;
        }
    }
    emit!(Exercised { round: round.key(), bidder: ctx.accounts.bidder.key(), qty });
    Ok(())
}

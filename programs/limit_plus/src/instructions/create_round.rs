use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{BaseStateWithExtensions, ExtensionType, StateWithExtensions},
    state::Mint as Mint2022,
};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::RoundCreated;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateRoundParams {
    pub round_id: u64,
    pub side: Side,
    pub pyth_feed_id: [u8; 32],
    pub contract_size_raw: u64,
    pub shares_per_contract_e9: u64,
    pub strike_per_contract: u64,
    pub reserve_premium_per_contract: u64,
    pub fair_premium_per_contract: u64,
    pub open_ts: i64,
    pub bid_start_ts: i64,
    pub candle_start_ts: i64,
    pub bid_end_ts: i64,
    pub reveal_end_ts: i64,
    pub expiry_ts: i64,
    pub exercise_window_secs: i64,
    pub settle_tolerance_secs: i64,
    pub settle_grace_secs: i64,
}

#[derive(Accounts)]
#[instruction(params: CreateRoundParams)]
pub struct CreateRound<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ LimitPlusError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(address = config.quote_mint @ LimitPlusError::WrongMint)]
    pub quote_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init, payer = admin, space = 8 + Round::INIT_SPACE,
        seeds = [ROUND_SEED, underlying_mint.key().as_ref(), &params.round_id.to_le_bytes()], bump
    )]
    pub round: Box<Account<'info, Round>>,
    #[account(
        init, payer = admin, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_QUOTE], bump,
        token::mint = quote_mint, token::authority = round, token::token_program = quote_token_program
    )]
    pub quote_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init, payer = admin, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_UNDERLYING], bump,
        token::mint = underlying_mint, token::authority = round, token::token_program = underlying_token_program
    )]
    pub underlying_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init, payer = admin, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_PREMIUM], bump,
        token::mint = quote_mint, token::authority = round, token::token_program = quote_token_program
    )]
    pub premium_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init, payer = admin, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_ESCROW], bump,
        token::mint = quote_mint, token::authority = round, token::token_program = quote_token_program
    )]
    pub escrow_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub quote_token_program: Interface<'info, TokenInterface>,
    pub underlying_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

fn check_underlying_extensions(mint: &AccountInfo) -> Result<()> {
    if *mint.owner != anchor_spl::token_2022::ID {
        return Ok(());
    }
    let data = mint.try_borrow_data()?;
    let state = StateWithExtensions::<Mint2022>::unpack(&data)?;
    for t in state.get_extension_types()? {
        match t {
            ExtensionType::TransferFeeConfig
            | ExtensionType::TransferHook
            | ExtensionType::NonTransferable
            | ExtensionType::ConfidentialTransferMint
            | ExtensionType::ConfidentialTransferFeeConfig
            | ExtensionType::InterestBearingConfig => {
                return err!(LimitPlusError::UnsupportedMintExtension)
            }
            _ => {}
        }
    }
    Ok(())
}

pub fn create_round_handler(ctx: Context<CreateRound>, p: CreateRoundParams) -> Result<()> {
    require_keys_eq!(
        *ctx.accounts.underlying_mint.to_account_info().owner,
        ctx.accounts.underlying_token_program.key(),
        LimitPlusError::WrongMint
    );
    check_underlying_extensions(&ctx.accounts.underlying_mint.to_account_info())?;

    // §4.1 timeline
    let ok = p.open_ts <= p.bid_start_ts
        && p.bid_start_ts <= p.candle_start_ts
        && p.candle_start_ts < p.bid_end_ts
        && p.bid_end_ts <= p.reveal_end_ts
        && p.reveal_end_ts <= p.expiry_ts
        && p.exercise_window_secs > 0
        && p.settle_tolerance_secs > 0
        && p.settle_grace_secs >= p.exercise_window_secs;
    require!(ok, LimitPlusError::InvalidTimeline);
    require!(
        p.contract_size_raw > 0 && p.strike_per_contract > 0 && p.shares_per_contract_e9 > 0,
        LimitPlusError::ZeroAmount
    );

    let r = &mut ctx.accounts.round;
    r.bump = ctx.bumps.round;
    r.round_id = p.round_id;
    r.side = p.side;
    r.state = RoundState::Deposit;
    r.creator = ctx.accounts.admin.key();
    r.underlying_mint = ctx.accounts.underlying_mint.key();
    r.quote_mint = ctx.accounts.quote_mint.key();
    r.underlying_token_program = ctx.accounts.underlying_token_program.key();
    r.quote_token_program = ctx.accounts.quote_token_program.key();
    r.pyth_feed_id = p.pyth_feed_id;
    r.contract_size_raw = p.contract_size_raw;
    r.shares_per_contract_e9 = p.shares_per_contract_e9;
    r.strike_per_contract = p.strike_per_contract;
    r.reserve_premium_per_contract = p.reserve_premium_per_contract;
    r.fair_premium_per_contract = p.fair_premium_per_contract;
    r.open_ts = p.open_ts;
    r.bid_start_ts = p.bid_start_ts;
    r.candle_start_ts = p.candle_start_ts;
    r.bid_end_ts = p.bid_end_ts;
    r.reveal_end_ts = p.reveal_end_ts;
    r.expiry_ts = p.expiry_ts;
    r.exercise_window_secs = p.exercise_window_secs;
    r.settle_tolerance_secs = p.settle_tolerance_secs;
    r.settle_grace_secs = p.settle_grace_secs;
    emit!(RoundCreated {
        round: r.key(),
        underlying_mint: r.underlying_mint,
        round_id: r.round_id,
        strike_per_contract: r.strike_per_contract,
        expiry_ts: r.expiry_ts,
    });
    Ok(())
}

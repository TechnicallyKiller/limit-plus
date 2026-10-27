use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod oracle;
pub mod randomness;
pub mod state;
pub mod token;

use instructions::*;

declare_id!("HX8kE9ryRfoFbs36CB49pHsPn2iUCFgfHzq17drGVLUs");

#[program]
pub mod limit_plus {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
        max_conf_bps: u16,
        quote_mint: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        initialize_config::initialize_config_handler(ctx, fee_bps, max_conf_bps, quote_mint, treasury)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: u16,
        max_conf_bps: u16,
        paused: bool,
        treasury: Pubkey,
    ) -> Result<()> {
        update_config::update_config_handler(ctx, fee_bps, max_conf_bps, paused, treasury)
    }

    pub fn create_round(ctx: Context<CreateRound>, params: CreateRoundParams) -> Result<()> {
        create_round::create_round_handler(ctx, params)
    }

    pub fn deposit(ctx: Context<Deposit>, contracts: u64) -> Result<()> {
        deposit::deposit_handler(ctx, contracts)
    }

    pub fn withdraw(ctx: Context<Withdraw>, contracts: u64) -> Result<()> {
        withdraw::withdraw_handler(ctx, contracts)
    }

    pub fn commit_bid(ctx: Context<CommitBid>, commitment: [u8; 32], escrow: u64) -> Result<()> {
        commit_bid::commit_bid_handler(ctx, commitment, escrow)
    }

    pub fn resolve_cutoff(ctx: Context<ResolveCutoff>) -> Result<()> {
        resolve_cutoff::resolve_cutoff_handler(ctx)
    }

    pub fn reveal_bid(ctx: Context<RevealBid>, price_per_contract: u64, qty: u64, salt: [u8; 32]) -> Result<()> {
        reveal_bid::reveal_bid_handler(ctx, price_per_contract, qty, salt)
    }

    pub fn clear_auction<'info>(ctx: Context<'_, '_, 'info, 'info, ClearAuction<'info>>) -> Result<()> {
        clear_auction::clear_auction_handler(ctx)
    }

    pub fn claim_premium(ctx: Context<ClaimPremium>) -> Result<()> {
        claim_premium::claim_premium_handler(ctx)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        claim_refund::claim_refund_handler(ctx)
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        settle::settle_handler(ctx)
    }

    pub fn expire_without_price(ctx: Context<ExpireWithoutPrice>) -> Result<()> {
        expire_without_price::expire_without_price_handler(ctx)
    }

    pub fn exercise(ctx: Context<Exercise>) -> Result<()> {
        exercise::exercise_handler(ctx)
    }

    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        finalize::finalize_handler(ctx)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        claim::claim_handler(ctx)
    }

    #[cfg(feature = "mock-oracle")]
    pub fn set_mock_price(
        ctx: Context<SetMockPrice>,
        feed_id: [u8; 32],
        price: i64,
        expo: i32,
        conf: u64,
        publish_time: i64,
    ) -> Result<()> {
        set_mock_price::set_mock_price_handler(ctx, feed_id, price, expo, conf, publish_time)
    }
}

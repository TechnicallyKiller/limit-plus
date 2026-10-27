use anchor_lang::prelude::*;

use crate::errors::LimitPlusError;

pub const MAX_BIDS_PER_ROUND: u16 = 20;

pub const CONFIG_SEED: &[u8] = b"config";
pub const ROUND_SEED: &[u8] = b"round";
pub const VAULT_SEED: &[u8] = b"vault";
pub const POSITION_SEED: &[u8] = b"position";
pub const BID_SEED: &[u8] = b"bid";
pub const MOCK_PRICE_SEED: &[u8] = b"mock_price";

pub const VAULT_QUOTE: &[u8] = b"quote";
pub const VAULT_UNDERLYING: &[u8] = b"underlying";
pub const VAULT_PREMIUM: &[u8] = b"premium";
pub const VAULT_ESCROW: &[u8] = b"escrow";

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Side {
    BuyLower,
    SellHigher,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum RoundState {
    Deposit,
    Bidding,
    Reveal,
    Cleared,
    NoSale,
    Settled,
    Finalized,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub bump: u8,
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub quote_mint: Pubkey,
    pub fee_bps: u16,
    pub max_conf_bps: u16,
    pub paused: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub bump: u8,
    pub round_id: u64,
    pub side: Side,
    pub state: RoundState,
    pub creator: Pubkey,
    pub underlying_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub underlying_token_program: Pubkey,
    pub quote_token_program: Pubkey,
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
    pub total_contracts: u64,
    pub depositor_count: u32,
    pub bid_count: u16,
    pub revealed_count: u16,
    pub cutoff_resolved: bool,
    pub cutoff_ts: i64,
    pub clearing_premium_per_contract: u64,
    pub sold_contracts: u64,
    pub premium_to_users: u64,
    pub fee_paid: u64,
    pub settled: bool,
    pub settle_price_per_contract: u64,
    pub settle_publish_time: i64,
    pub in_the_money: bool,
    pub exercised_contracts: u64,
    pub final_quote: u64,
    pub final_underlying: u64,
}

impl Round {
    /// State may only move forward.
    pub fn advance(&mut self, next: RoundState) -> Result<()> {
        require!(self.state.rank() < next.rank(), LimitPlusError::WrongPhase);
        self.state = next;
        Ok(())
    }

    pub fn require_state(&self, allowed: &[RoundState]) -> Result<()> {
        require!(allowed.contains(&self.state), LimitPlusError::WrongPhase);
        Ok(())
    }

    /// Deposit window: `open_ts <= now < bid_start_ts`, before the cutoff is resolved.
    pub fn require_deposit_window(&self, now: i64) -> Result<()> {
        self.require_state(&[RoundState::Deposit])?;
        require!(now >= self.open_ts, LimitPlusError::TooEarly);
        require!(now < self.bid_start_ts, LimitPlusError::TooLate);
        Ok(())
    }

    pub fn require_bidding_window(&self, now: i64) -> Result<()> {
        self.require_state(&[RoundState::Deposit])?;
        require!(now >= self.bid_start_ts, LimitPlusError::TooEarly);
        require!(now < self.bid_end_ts, LimitPlusError::TooLate);
        Ok(())
    }

    pub fn require_reveal_window(&self, now: i64) -> Result<()> {
        self.require_state(&[RoundState::Reveal])?;
        require!(now < self.reveal_end_ts, LimitPlusError::TooLate);
        Ok(())
    }

    pub fn require_clear_time(&self, now: i64) -> Result<()> {
        self.require_state(&[RoundState::Reveal])?;
        require!(now >= self.reveal_end_ts, LimitPlusError::TooEarly);
        Ok(())
    }

    /// True once the auction has been cleared (premium / refund claims allowed).
    pub fn is_post_clear(&self) -> bool {
        matches!(
            self.state,
            RoundState::Cleared | RoundState::NoSale | RoundState::Settled | RoundState::Finalized
        )
    }

    pub fn collateral_seed(&self) -> &'static [u8] {
        match self.side {
            Side::BuyLower => VAULT_QUOTE,
            Side::SellHigher => VAULT_UNDERLYING,
        }
    }

    pub fn collateral_mint(&self) -> Pubkey {
        match self.side {
            Side::BuyLower => self.quote_mint,
            Side::SellHigher => self.underlying_mint,
        }
    }

    pub fn collateral_token_program(&self) -> Pubkey {
        match self.side {
            Side::BuyLower => self.quote_token_program,
            Side::SellHigher => self.underlying_token_program,
        }
    }
}

impl RoundState {
    pub fn rank(&self) -> u8 {
        match self {
            RoundState::Deposit => 0,
            RoundState::Bidding => 1,
            RoundState::Reveal => 2,
            RoundState::Cleared | RoundState::NoSale => 3,
            RoundState::Settled => 4,
            RoundState::Finalized => 5,
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub bump: u8,
    pub round: Pubkey,
    pub owner: Pubkey,
    pub contracts: u64,
    pub premium_claimed: bool,
    pub claimed: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Bid {
    pub bump: u8,
    pub round: Pubkey,
    pub bidder: Pubkey,
    pub commitment: [u8; 32],
    pub escrow: u64,
    pub commit_ts: i64,
    pub revealed: bool,
    pub valid: bool,
    pub price_per_contract: u64,
    pub qty: u64,
    pub won_qty: u64,
    pub paid: u64,
    pub refunded: bool,
    pub exercised: bool,
}

#[cfg(feature = "mock-oracle")]
#[account]
#[derive(InitSpace)]
pub struct MockPrice {
    pub bump: u8,
    pub feed_id: [u8; 32],
    pub price: i64,
    pub expo: i32,
    pub conf: u64,
    pub publish_time: i64,
}

/// Binds `$seeds` to the round PDA signer seeds: `let seeds: [&[u8]; 4]`.
#[macro_export]
macro_rules! round_signer {
    ($round:expr => $seeds:ident) => {
        let __id = $round.round_id.to_le_bytes();
        let __bump = [$round.bump];
        let __um = $round.underlying_mint;
        let $seeds: [&[u8]; 4] = [$crate::state::ROUND_SEED, __um.as_ref(), &__id, &__bump];
    };
}

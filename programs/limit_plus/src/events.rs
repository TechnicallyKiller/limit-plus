use anchor_lang::prelude::*;

#[event]
pub struct RoundCreated {
    pub round: Pubkey,
    pub underlying_mint: Pubkey,
    pub round_id: u64,
    pub strike_per_contract: u64,
    pub expiry_ts: i64,
}
#[event]
pub struct Deposited {
    pub round: Pubkey,
    pub owner: Pubkey,
    pub contracts: u64,
}
#[event]
pub struct Withdrawn {
    pub round: Pubkey,
    pub owner: Pubkey,
    pub contracts: u64,
}
#[event]
pub struct BidCommitted {
    pub round: Pubkey,
    pub bidder: Pubkey,
    pub escrow: u64,
}
#[event]
pub struct CutoffResolved {
    pub round: Pubkey,
    pub cutoff_ts: i64,
}
#[event]
pub struct BidRevealed {
    pub round: Pubkey,
    pub bidder: Pubkey,
    pub valid: bool,
}
#[event]
pub struct AuctionCleared {
    pub round: Pubkey,
    pub clearing: u64,
    pub sold: u64,
    pub premium_to_users: u64,
    pub fee: u64,
}
#[event]
pub struct NoSale {
    pub round: Pubkey,
}
#[event]
pub struct PremiumClaimed {
    pub round: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}
#[event]
pub struct Settled {
    pub round: Pubkey,
    pub price_per_contract: u64,
    pub publish_time: i64,
    pub in_the_money: bool,
}
#[event]
pub struct Exercised {
    pub round: Pubkey,
    pub bidder: Pubkey,
    pub qty: u64,
}
#[event]
pub struct Finalized {
    pub round: Pubkey,
    pub final_quote: u64,
    pub final_underlying: u64,
}
#[event]
pub struct Claimed {
    pub round: Pubkey,
    pub owner: Pubkey,
    pub quote: u64,
    pub underlying: u64,
}
#[event]
pub struct Refunded {
    pub round: Pubkey,
    pub bidder: Pubkey,
    pub amount: u64,
}
#[event]
pub struct ConfigUpdated {
    pub paused: bool,
    pub fee_bps: u16,
}

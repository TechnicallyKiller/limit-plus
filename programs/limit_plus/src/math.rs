//! Pure fixed-point helpers. No account access, no inline math anywhere else.
use anchor_lang::prelude::*;


use crate::errors::LimitPlusError;
use crate::state::Side;

fn ovf() -> Error {
    error!(LimitPlusError::MathOverflow)
}

pub fn mul_u64(a: u64, b: u64) -> Result<u64> {
    a.checked_mul(b).ok_or_else(ovf)
}

pub fn add_u64(a: u64, b: u64) -> Result<u64> {
    a.checked_add(b).ok_or_else(ovf)
}

pub fn sub_u64(a: u64, b: u64) -> Result<u64> {
    a.checked_sub(b).ok_or_else(ovf)
}

fn pow10(exp: u32) -> Result<u128> {
    10u128.checked_pow(exp).ok_or_else(ovf)
}

/// price × 10^(Q + expo), in quote base units per whole share (floor).
pub fn price_per_share_quote(price: i64, expo: i32, quote_decimals: u8) -> Result<u128> {
    require!(price > 0, LimitPlusError::OracleInvalidPrice);
    let p = price as u128;
    let e = (quote_decimals as i32).checked_add(expo).ok_or_else(ovf)?;
    if e >= 0 {
        p.checked_mul(pow10(e as u32)?).ok_or_else(ovf)
    } else {
        Ok(p / pow10(e.unsigned_abs())?)
    }
}

/// Price of one contract in quote base units (floor).
pub fn settle_price_per_contract(
    price: i64,
    expo: i32,
    quote_decimals: u8,
    shares_per_contract_e9: u64,
) -> Result<u64> {
    let per_share = price_per_share_quote(price, expo, quote_decimals)?;
    let v = per_share
        .checked_mul(shares_per_contract_e9 as u128)
        .ok_or_else(ovf)?
        / 1_000_000_000u128;
    u64::try_from(v).map_err(|_| ovf())
}

pub fn is_in_the_money(side: Side, settle_price: u64, strike: u64) -> bool {
    match side {
        Side::BuyLower => settle_price < strike,
        Side::SellHigher => settle_price > strike,
    }
}

/// floor(amount × part / total)
pub fn pro_rata(amount: u64, part: u64, total: u64) -> Result<u64> {
    if total == 0 {
        return Ok(0);
    }
    let v = (amount as u128)
        .checked_mul(part as u128)
        .ok_or_else(ovf)?
        / (total as u128);
    u64::try_from(v).map_err(|_| ovf())
}

/// Returns (fee, premium_to_users); fee is floored so the two always sum to the total.
pub fn fee_split(total_premium: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let fee = pro_rata(total_premium, fee_bps as u64, 10_000)?;
    Ok((fee, sub_u64(total_premium, fee)?))
}

/// Maps a 32-byte seed into [candle_start_ts, bid_end_ts].
pub fn cutoff_from_seed(seed: &[u8; 32], candle_start_ts: i64, bid_end_ts: i64) -> Result<i64> {
    let span = bid_end_ts.checked_sub(candle_start_ts).ok_or_else(ovf)?;
    require!(span >= 0, LimitPlusError::InvalidTimeline);
    let mut b = [0u8; 8];
    b.copy_from_slice(&seed[0..8]);
    let r = u64::from_le_bytes(b);
    let m = (span as u64).checked_add(1).ok_or_else(ovf)?;
    let offset = (r % m) as i64;
    candle_start_ts.checked_add(offset).ok_or_else(ovf)
}

/// keccak256(round || bidder || price_le || qty_le || salt)
pub fn commitment_hash(
    round: &Pubkey,
    bidder: &Pubkey,
    price_per_contract: u64,
    qty: u64,
    salt: &[u8; 32],
) -> [u8; 32] {
    solana_keccak_hasher::hashv(&[
        round.as_ref(),
        bidder.as_ref(),
        &price_per_contract.to_le_bytes(),
        &qty.to_le_bytes(),
        salt,
    ])
    .0
}

/// Collateral a depositor locks for `contracts`: strike USDC (BuyLower) or underlying units (SellHigher).
pub fn collateral_amount(side: Side, contracts: u64, strike_per_contract: u64, contract_size_raw: u64) -> Result<u64> {
    match side {
        Side::BuyLower => mul_u64(contracts, strike_per_contract),
        Side::SellHigher => mul_u64(contracts, contract_size_raw),
    }
}

/// Oracle confidence must be at most `max_conf_bps` of the price.
pub fn confidence_ok(price: i64, conf: u64, max_conf_bps: u16) -> Result<bool> {
    require!(price > 0, LimitPlusError::OracleInvalidPrice);
    let lhs = (conf as u128).checked_mul(10_000).ok_or_else(ovf)?;
    let rhs = (price as u128).checked_mul(max_conf_bps as u128).ok_or_else(ovf)?;
    Ok(lhs <= rhs)
}

/// price × qty <= escrow, in u128 so it cannot overflow.
pub fn bid_cost_within_escrow(price_per_contract: u64, qty: u64, escrow: u64) -> bool {
    (price_per_contract as u128) * (qty as u128) <= escrow as u128
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn u1_price_per_share_quote() {
        // $100.00 with expo -5 (10_000_000), Q=6 -> 100_000_000
        assert_eq!(price_per_share_quote(10_000_000, -5, 6).unwrap(), 100_000_000);
        // expo -8: 100.00 = 10_000_000_000 -> 100_000_000
        assert_eq!(price_per_share_quote(10_000_000_000, -8, 6).unwrap(), 100_000_000);
        // Q + expo < 0 floors: 123_456_789 * 10^-2 (expo -8, Q 6)
        assert_eq!(price_per_share_quote(123_456_789, -8, 6).unwrap(), 1_234_567);
        // positive exponent sum: expo 2, Q 6 -> multiply by 10^8
        assert_eq!(price_per_share_quote(3, 2, 6).unwrap(), 300_000_000);
        assert!(price_per_share_quote(0, -5, 6).is_err());
        assert!(price_per_share_quote(-1, -5, 6).is_err());
    }

    #[test]
    fn u2_settle_price_per_contract() {
        // 0.01 share, price $180 -> $1.80 = 1_800_000
        let p = settle_price_per_contract(18_000_000, -5, 6, 10_000_000).unwrap();
        assert_eq!(p, 1_800_000);
        // floors
        let p = settle_price_per_contract(18_000_001, -5, 6, 10_000_000).unwrap();
        assert_eq!(p, 1_800_000);
    }

    #[test]
    fn itm_rules() {
        assert!(is_in_the_money(Side::BuyLower, 1_799_999, 1_800_000));
        assert!(!is_in_the_money(Side::BuyLower, 1_800_000, 1_800_000));
        assert!(is_in_the_money(Side::SellHigher, 1_800_001, 1_800_000));
        assert!(!is_in_the_money(Side::SellHigher, 1_800_000, 1_800_000));
    }

    #[test]
    fn u3_pro_rata_never_exceeds_total() {
        // deterministic xorshift so the property test needs no extra crates
        let mut s: u64 = 0x9E3779B97F4A7C15;
        let mut next = || {
            s ^= s << 13;
            s ^= s >> 7;
            s ^= s << 17;
            s
        };
        for _ in 0..1000 {
            let amount = next() % 1_000_000_000_000;
            let n = (next() % 8 + 1) as usize;
            let cs: Vec<u64> = (0..n).map(|_| next() % 10_000 + 1).collect();
            let total: u64 = cs.iter().sum();
            let paid: u64 = cs.iter().map(|c| pro_rata(amount, *c, total).unwrap()).sum();
            assert!(paid <= amount);
        }
        assert_eq!(pro_rata(100, 1, 0).unwrap(), 0);
    }

    #[test]
    fn u4_fee_split_sums() {
        for total in [0u64, 1, 9, 999, 1_000_000, u64::MAX / 2] {
            for bps in [0u16, 1, 1000, 2000] {
                let (fee, users) = fee_split(total, bps).unwrap();
                assert_eq!(fee + users, total);
            }
        }
        assert_eq!(fee_split(1000, 1000).unwrap(), (100, 900));
    }

    #[test]
    fn u5_overflow_is_an_error() {
        assert!(mul_u64(u64::MAX, 2).is_err());
        assert!(add_u64(u64::MAX, 1).is_err());
        assert!(sub_u64(0, 1).is_err());
        assert!(pro_rata(u64::MAX, u64::MAX, 1).is_err());
        assert!(settle_price_per_contract(i64::MAX, 30, 6, u64::MAX).is_err());
        assert!(price_per_share_quote(1, 100, 6).is_err());
    }

    #[test]
    fn u6_cutoff_in_range() {
        let mut seed = [0u8; 32];
        for i in 0..200u64 {
            seed[0..8].copy_from_slice(&i.wrapping_mul(0x9E3779B97F4A7C15).to_le_bytes());
            let c = cutoff_from_seed(&seed, 1000, 1600).unwrap();
            assert!((1000..=1600).contains(&c));
        }
        // span 0
        assert_eq!(cutoff_from_seed(&seed, 500, 500).unwrap(), 500);
        // inverted
        assert!(cutoff_from_seed(&seed, 600, 500).is_err());
    }

    #[test]
    fn u7_commitment_vector() {
        let round = Pubkey::new_from_array([1u8; 32]);
        let bidder = Pubkey::new_from_array([2u8; 32]);
        let h = commitment_hash(&round, &bidder, 123_456, 7, &[9u8; 32]);
        let hex: String = h.iter().map(|b| format!("{:02x}", b)).collect();
        assert_eq!(hex, COMMITMENT_VECTOR);
    }

    /// Shared with the TS test X1 (packages/sdk/test/commitment.test.ts).
    pub const COMMITMENT_VECTOR: &str = "ee711ac9e48202ee1e5703540df8703cf36022706a0a921f6e4c1b0eeda3aadc";
}

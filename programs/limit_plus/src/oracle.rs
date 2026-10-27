//! Price reading. Pyth path decodes `PriceUpdateV2` manually (SPEC §7.4);
//! the mock path (feature `mock-oracle`) reads a `MockPrice` PDA.
use anchor_lang::prelude::*;

use crate::errors::LimitPlusError;

pub struct OraclePrice {
    pub price: i64,
    pub expo: i32,
    pub conf: u64,
    pub publish_time: i64,
}

/// Pyth Solana Receiver program (owner of PriceUpdateV2 accounts).
pub const PYTH_RECEIVER_ID: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

const DISCRIMINATOR_LEN: usize = 8;
const PRICE_UPDATE_V2_DISCRIMINATOR: [u8; 8] = [34, 241, 35, 99, 157, 126, 244, 205];

/// Byte layout after the discriminator: write_authority (32), verification_level (1 tag, +1 if Partial),
/// then PriceFeedMessage: feed_id (32), price i64, conf u64, exponent i32, publish_time i64, ...
pub fn decode_price_update_v2(data: &[u8], expected_feed_id: &[u8; 32]) -> Result<OraclePrice> {
    require!(
        data.len() >= DISCRIMINATOR_LEN && data[..DISCRIMINATOR_LEN] == PRICE_UPDATE_V2_DISCRIMINATOR,
        LimitPlusError::OracleInvalidPrice
    );
    let mut o = DISCRIMINATOR_LEN + 32;
    let tag = *data.get(o).ok_or(LimitPlusError::OracleInvalidPrice)?;
    // Only Full verification (tag 1) is accepted. Partial (tag 0) carries one more byte.
    require!(tag == 1, LimitPlusError::OracleInvalidPrice);
    o += 1;
    let msg = data.get(o..o + 32 + 8 + 8 + 4 + 8).ok_or(LimitPlusError::OracleInvalidPrice)?;
    require!(&msg[0..32] == expected_feed_id.as_ref(), LimitPlusError::OracleFeedMismatch);
    let rd8 = |s: usize| -> [u8; 8] {
        let mut b = [0u8; 8];
        b.copy_from_slice(&msg[s..s + 8]);
        b
    };
    let mut e = [0u8; 4];
    e.copy_from_slice(&msg[48..52]);
    Ok(OraclePrice {
        price: i64::from_le_bytes(rd8(32)),
        conf: u64::from_le_bytes(rd8(40)),
        expo: i32::from_le_bytes(e),
        publish_time: i64::from_le_bytes(rd8(52)),
    })
}

#[cfg(not(feature = "mock-oracle"))]
pub fn read_price(account: &AccountInfo, expected_feed_id: &[u8; 32]) -> Result<OraclePrice> {
    require!(*account.owner == PYTH_RECEIVER_ID, LimitPlusError::OracleInvalidPrice);
    let data = account.try_borrow_data()?;
    decode_price_update_v2(&data, expected_feed_id)
}

#[cfg(feature = "mock-oracle")]
pub fn read_price(account: &AccountInfo, expected_feed_id: &[u8; 32]) -> Result<OraclePrice> {
    use crate::state::{MockPrice, MOCK_PRICE_SEED};
    require!(*account.owner == crate::ID, LimitPlusError::OracleInvalidPrice);
    let (expected, _) = Pubkey::find_program_address(&[MOCK_PRICE_SEED, expected_feed_id.as_ref()], &crate::ID);
    require_keys_eq!(account.key(), expected, LimitPlusError::OracleFeedMismatch);
    let data = account.try_borrow_data()?;
    let mp = MockPrice::try_deserialize(&mut &data[..])?;
    require!(&mp.feed_id == expected_feed_id, LimitPlusError::OracleFeedMismatch);
    Ok(OraclePrice { price: mp.price, expo: mp.expo, conf: mp.conf, publish_time: mp.publish_time })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(feed: [u8; 32], price: i64, conf: u64, expo: i32, t: i64, tag: u8) -> Vec<u8> {
        let mut d = PRICE_UPDATE_V2_DISCRIMINATOR.to_vec();
        d.extend_from_slice(&[7u8; 32]);
        d.push(tag);
        d.extend_from_slice(&feed);
        d.extend_from_slice(&price.to_le_bytes());
        d.extend_from_slice(&conf.to_le_bytes());
        d.extend_from_slice(&expo.to_le_bytes());
        d.extend_from_slice(&t.to_le_bytes());
        d.extend_from_slice(&[0u8; 8 * 4]);
        d
    }

    #[test]
    fn o3_decodes_price_update_v2_layout() {
        let feed = [5u8; 32];
        let d = sample(feed, 18_000_000, 1_000, -5, 1_700_000_000, 1);
        let p = decode_price_update_v2(&d, &feed).unwrap();
        assert_eq!((p.price, p.conf, p.expo, p.publish_time), (18_000_000, 1_000, -5, 1_700_000_000));
    }

    #[test]
    fn rejects_wrong_feed_partial_and_garbage() {
        let feed = [5u8; 32];
        assert!(decode_price_update_v2(&sample(feed, 1, 1, -5, 1, 1), &[6u8; 32]).is_err());
        assert!(decode_price_update_v2(&sample(feed, 1, 1, -5, 1, 0), &feed).is_err());
        assert!(decode_price_update_v2(&[0u8; 10], &feed).is_err());
    }
}

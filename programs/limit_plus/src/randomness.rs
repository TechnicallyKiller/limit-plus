//! Cutoff randomness. MVP: SlotHashes. Swapping in Switchboard means changing only this file.
use anchor_lang::prelude::*;


use crate::errors::LimitPlusError;
use crate::math;

/// Reads the most recent hash from raw SlotHashes sysvar data and derives the cutoff.
/// Layout: data[0..8] = entry count, then entries of (slot u64, hash [u8;32]).
pub fn derive_cutoff(
    slot_hashes_data: &[u8],
    round: &Pubkey,
    candle_start_ts: i64,
    bid_end_ts: i64,
) -> Result<i64> {
    require!(slot_hashes_data.len() >= 48, LimitPlusError::RandomnessInvalid);
    let hash = &slot_hashes_data[16..48];
    let seed = solana_keccak_hasher::hashv(&[hash, round.as_ref(), &bid_end_ts.to_le_bytes()]).0;
    math::cutoff_from_seed(&seed, candle_start_ts, bid_end_ts)
}

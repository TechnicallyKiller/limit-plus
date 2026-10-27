use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::LimitPlusError;
use crate::events::{AuctionCleared, NoSale};
use crate::math;
use crate::state::*;
use crate::token::transfer_vault;

#[derive(Accounts)]
pub struct ClearAuction<'info> {
    pub cranker: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [ROUND_SEED, round.underlying_mint.as_ref(), &round.round_id.to_le_bytes()], bump = round.bump
    )]
    pub round: Box<Account<'info, Round>>,
    #[account(address = round.quote_mint @ LimitPlusError::WrongMint)]
    pub quote_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(seeds = [VAULT_SEED, round.key().as_ref(), VAULT_QUOTE], bump, token::mint = quote_mint)]
    pub quote_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(seeds = [VAULT_SEED, round.key().as_ref(), VAULT_UNDERLYING], bump)]
    pub underlying_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_PREMIUM], bump, token::mint = quote_mint)]
    pub premium_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [VAULT_SEED, round.key().as_ref(), VAULT_ESCROW], bump, token::mint = quote_mint)]
    pub escrow_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = config.treasury @ LimitPlusError::Unauthorized, token::mint = quote_mint)]
    pub treasury: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = round.quote_token_program)]
    pub quote_token_program: Interface<'info, TokenInterface>,
}

struct Candidate {
    idx: usize,
    price: u64,
    commit_ts: i64,
    bidder: Pubkey,
}

pub fn clear_auction_handler<'info>(ctx: Context<'_, '_, 'info, 'info, ClearAuction<'info>>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round_key = ctx.accounts.round.key();
    ctx.accounts.round.require_clear_time(now)?;
    let infos = ctx.remaining_accounts;
    require!(infos.len() == ctx.accounts.round.bid_count as usize, LimitPlusError::BidAccountsMismatch);

    // Load and validate every bid account.
    let mut bids: Vec<Bid> = Vec::with_capacity(infos.len());
    let mut seen: Vec<Pubkey> = Vec::with_capacity(infos.len());
    for info in infos.iter() {
        require!(*info.owner == crate::ID && info.is_writable, LimitPlusError::BidAccountsMismatch);
        let bid = {
            let data = info.try_borrow_data()?;
            Bid::try_deserialize(&mut &data[..]).map_err(|_| error!(LimitPlusError::BidAccountsMismatch))?
        };
        require_keys_eq!(bid.round, round_key, LimitPlusError::BidAccountsMismatch);
        let (pda, _) = Pubkey::find_program_address(&[BID_SEED, round_key.as_ref(), bid.bidder.as_ref()], &crate::ID);
        require_keys_eq!(pda, info.key(), LimitPlusError::BidAccountsMismatch);
        require!(!seen.contains(&info.key()), LimitPlusError::BidAccountsMismatch);
        seen.push(info.key());
        bids.push(bid);
    }

    // Deterministic order: price desc, commit_ts asc, bidder asc.
    let mut cands: Vec<Candidate> = bids
        .iter()
        .enumerate()
        .filter(|(_, b)| b.valid && b.revealed)
        .map(|(idx, b)| Candidate { idx, price: b.price_per_contract, commit_ts: b.commit_ts, bidder: b.bidder })
        .collect();
    cands.sort_by(|a, b| {
        b.price
            .cmp(&a.price)
            .then(a.commit_ts.cmp(&b.commit_ts))
            .then(a.bidder.to_bytes().cmp(&b.bidder.to_bytes()))
    });

    let total = ctx.accounts.round.total_contracts;
    let mut remaining = total;
    let mut clearing = 0u64;
    let mut sold = 0u64;
    for c in cands.iter() {
        if remaining == 0 {
            break;
        }
        let fill = bids[c.idx].qty.min(remaining);
        if fill == 0 {
            continue;
        }
        bids[c.idx].won_qty = fill;
        remaining -= fill;
        sold = math::add_u64(sold, fill)?;
        clearing = c.price;
    }

    let round = &mut ctx.accounts.round;
    if sold == 0 {
        round.final_quote = ctx.accounts.quote_vault.amount;
        round.final_underlying = ctx.accounts.underlying_vault.amount;
        round.advance(RoundState::NoSale)?;
        emit!(NoSale { round: round_key });
    } else {
        for b in bids.iter_mut() {
            b.paid = math::mul_u64(b.won_qty, clearing)?;
        }
        let total_premium = math::mul_u64(sold, clearing)?;
        let (fee, to_users) = math::fee_split(total_premium, ctx.accounts.config.fee_bps)?;
        round.clearing_premium_per_contract = clearing;
        round.sold_contracts = sold;
        round.premium_to_users = to_users;
        round.fee_paid = fee;
        round.advance(RoundState::Cleared)?;

        crate::round_signer!(round => seeds);
        transfer_vault(
            &ctx.accounts.quote_token_program,
            &ctx.accounts.escrow_vault,
            &ctx.accounts.quote_mint,
            &ctx.accounts.treasury,
            &round.to_account_info(),
            &seeds,
            fee,
        )?;
        transfer_vault(
            &ctx.accounts.quote_token_program,
            &ctx.accounts.escrow_vault,
            &ctx.accounts.quote_mint,
            &ctx.accounts.premium_vault,
            &round.to_account_info(),
            &seeds,
            to_users,
        )?;
        emit!(AuctionCleared { round: round_key, clearing, sold, premium_to_users: to_users, fee });
    }

    for (info, bid) in infos.iter().zip(bids.iter()) {
        let mut data = info.try_borrow_mut_data()?;
        bid.try_serialize(&mut &mut data[..])?;
    }
    Ok(())
}

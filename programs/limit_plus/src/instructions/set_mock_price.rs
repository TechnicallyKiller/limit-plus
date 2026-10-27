use anchor_lang::prelude::*;

use crate::errors::LimitPlusError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(feed_id: [u8; 32])]
pub struct SetMockPrice<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ LimitPlusError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(
        init_if_needed, payer = admin, space = 8 + MockPrice::INIT_SPACE,
        seeds = [MOCK_PRICE_SEED, feed_id.as_ref()], bump
    )]
    pub mock_price: Account<'info, MockPrice>,
    pub system_program: Program<'info, System>,
}

pub fn set_mock_price_handler(
    ctx: Context<SetMockPrice>,
    feed_id: [u8; 32],
    price: i64,
    expo: i32,
    conf: u64,
    publish_time: i64,
) -> Result<()> {
    let m = &mut ctx.accounts.mock_price;
    m.bump = ctx.bumps.mock_price;
    m.feed_id = feed_id;
    m.price = price;
    m.expo = expo;
    m.conf = conf;
    m.publish_time = publish_time;
    Ok(())
}

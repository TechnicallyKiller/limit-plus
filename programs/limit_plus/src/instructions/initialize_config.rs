use anchor_lang::prelude::*;

use crate::errors::LimitPlusError;
use crate::state::{Config, CONFIG_SEED};

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_config_handler(
    ctx: Context<InitializeConfig>,
    fee_bps: u16,
    max_conf_bps: u16,
    quote_mint: Pubkey,
    treasury: Pubkey,
) -> Result<()> {
    require!(fee_bps <= 2000, LimitPlusError::FeeTooHigh);
    let c = &mut ctx.accounts.config;
    c.bump = ctx.bumps.config;
    c.admin = ctx.accounts.admin.key();
    c.treasury = treasury;
    c.quote_mint = quote_mint;
    c.fee_bps = fee_bps;
    c.max_conf_bps = max_conf_bps;
    c.paused = false;
    Ok(())
}

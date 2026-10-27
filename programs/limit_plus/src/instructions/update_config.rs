use anchor_lang::prelude::*;

use crate::errors::LimitPlusError;
use crate::events::ConfigUpdated;
use crate::state::{Config, CONFIG_SEED};

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ LimitPlusError::Unauthorized)]
    pub config: Account<'info, Config>,
}

pub fn update_config_handler(
    ctx: Context<UpdateConfig>,
    fee_bps: u16,
    max_conf_bps: u16,
    paused: bool,
    treasury: Pubkey,
) -> Result<()> {
    require!(fee_bps <= 2000, LimitPlusError::FeeTooHigh);
    let c = &mut ctx.accounts.config;
    c.fee_bps = fee_bps;
    c.max_conf_bps = max_conf_bps;
    c.paused = paused;
    c.treasury = treasury;
    emit!(ConfigUpdated { paused, fee_bps });
    Ok(())
}

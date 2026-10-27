use anchor_lang::prelude::*;

declare_id!("HX8kE9ryRfoFbs36CB49pHsPn2iUCFgfHzq17drGVLUs");

#[program]
pub mod limit_plus {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

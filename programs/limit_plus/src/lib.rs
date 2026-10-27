use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod oracle;
pub mod randomness;
pub mod state;

declare_id!("HX8kE9ryRfoFbs36CB49pHsPn2iUCFgfHzq17drGVLUs");

#[program]
pub mod limit_plus {
    use super::*;
}

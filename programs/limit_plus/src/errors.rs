use anchor_lang::prelude::*;

#[error_code]
pub enum LimitPlusError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Program is paused")]
    Paused,
    #[msg("Wrong phase for this instruction")]
    WrongPhase,
    #[msg("Too early")]
    TooEarly,
    #[msg("Too late")]
    TooLate,
    #[msg("Invalid timeline")]
    InvalidTimeline,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Unsupported mint extension")]
    UnsupportedMintExtension,
    #[msg("Wrong mint")]
    WrongMint,
    #[msg("Too many bids")]
    TooManyBids,
    #[msg("Commitment mismatch")]
    CommitmentMismatch,
    #[msg("Bid accounts mismatch")]
    BidAccountsMismatch,
    #[msg("Oracle feed mismatch")]
    OracleFeedMismatch,
    #[msg("Oracle price outside the settlement window")]
    OracleOutsideWindow,
    #[msg("Oracle confidence too wide")]
    OracleConfidenceTooWide,
    #[msg("Oracle price invalid")]
    OracleInvalidPrice,
    #[msg("Not in the money")]
    NotInTheMoney,
    #[msg("Nothing to exercise")]
    NothingToExercise,
    #[msg("Already exercised")]
    AlreadyExercised,
    #[msg("Exercise window closed")]
    ExerciseWindowClosed,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Already refunded")]
    AlreadyRefunded,
    #[msg("Bid already revealed")]
    AlreadyRevealed,
    #[msg("Fee too high")]
    FeeTooHigh,
    #[msg("Oracle not implemented")]
    OracleUnavailable,
    #[msg("Randomness account invalid")]
    RandomnessInvalid,
}

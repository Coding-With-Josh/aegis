use anchor_lang::prelude::*;

declare_id!("4fphJK6m2gbb8zdbkpk8JcNzVgpiMucZ6hRkVcnhoNBD");

#[program]
pub mod aegis_test {
    use super::*;

    pub fn init_counter(ctx: Context<InitCounter>) -> Result<()> {
        ctx.accounts.counter.value = 0;
        Ok(())
    }

    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        ctx.accounts.counter.value = ctx.accounts.counter.value.checked_add(1).unwrap();
        Ok(())
    }

    pub fn init_trades(ctx: Context<InitTrades>) -> Result<()> {
        ctx.accounts.trades.count = 0;
        ctx.accounts.trades.last_amount = 0;
        Ok(())
    }

    pub fn trade(ctx: Context<Trade>, amount: u64) -> Result<()> {
        ctx.accounts.trades.count = ctx.accounts.trades.count.checked_add(1).unwrap();
        ctx.accounts.trades.last_amount = amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitCounter<'info> {
    #[account(init, payer = authority, space = 8 + 8, seeds = [b"counter"], bump)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut, seeds = [b"counter"], bump)]
    pub counter: Account<'info, Counter>,
}

#[derive(Accounts)]
pub struct InitTrades<'info> {
    #[account(init, payer = authority, space = 8 + 8 + 8, seeds = [b"trades"], bump)]
    pub trades: Account<'info, TradeState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut, seeds = [b"trades"], bump)]
    pub trades: Account<'info, TradeState>,
}

#[account]
pub struct Counter {
    pub value: u64,
}

#[account]
pub struct TradeState {
    pub count: u64,
    pub last_amount: u64,
}

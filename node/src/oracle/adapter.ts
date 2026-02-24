export interface OracleAdapter {
  getPriceUSD(mint: string): Promise<number>;
}

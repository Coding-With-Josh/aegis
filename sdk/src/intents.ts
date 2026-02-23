import type { Intent } from "./types.js";

export interface TransferParams {
  to: string;
  amount: number;
  mint?: string;
  decimals?: number;
}

export interface SwapParams {
  fromMint: string;
  toMint: string;
  amount: number;
  slippageBps?: number;
}

export interface StakeParams {
  amount: number;
  voteAccount: string;
}

export interface LendParams {
  protocol: "marginfi" | "solend";
  mint: string;
  amount: number;
  decimals?: number;
}

export interface FlashAccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface FlashInstruction {
  programId: string;
  data: string;
  accounts: FlashAccountMeta[];
}

export interface FlashParams {
  mint: string;
  amount: number;
  instructions: FlashInstruction[];
}

export interface CpiParams {
  programId: string;
  data: string;
  accounts: FlashAccountMeta[];
}

function toParams(p: unknown): Record<string, unknown> {
  return p as Record<string, unknown>;
}

export function transfer(params: TransferParams): Intent {
  return { type: "transfer", params: toParams(params) };
}

export function swap(params: SwapParams): Intent {
  return { type: "swap", params: toParams(params) };
}

export function stake(params: StakeParams): Intent {
  return { type: "stake", params: toParams(params) };
}

export function lend(params: LendParams): Intent {
  return { type: "lend", params: toParams(params) };
}

export function flash(params: FlashParams): Intent {
  return { type: "flash", params: toParams(params) };
}

export function cpi(params: CpiParams): Intent {
  return { type: "cpi", params: toParams(params) };
}

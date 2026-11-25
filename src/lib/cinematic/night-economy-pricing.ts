export type TradeTerms = {
  maximum: number;
  winChance: number;
  winRate: number;
  lossRate: number;
  cooldownMs: number;
};

export function projectTrade(amount: number, terms: Pick<TradeTerms, 'winRate' | 'lossRate'>) {
  return { win: Math.floor(amount * terms.winRate), loss: Math.floor(amount * terms.lossRate) };
}

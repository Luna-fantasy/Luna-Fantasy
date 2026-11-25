const economyAssets = '/luna-cinematic/economy';

export const cinematicBankHero = `${economyAssets}/bank.webp`;
export const cinematicBazaarHero = `${economyAssets}/bazaar.webp`;

const merchantHeroFiles = {
  kael: 'kael.webp',
  meluna: 'meluna.webp',
  zoldar: 'zoldar.webp',
  seluna: 'seluna.webp',
  brimor: 'brimor.webp',
  mells: 'mells.webp',
} as const;

export function cinematicMerchantHero(merchant: keyof typeof merchantHeroFiles) {
  return `${economyAssets}/${merchantHeroFiles[merchant]}`;
}

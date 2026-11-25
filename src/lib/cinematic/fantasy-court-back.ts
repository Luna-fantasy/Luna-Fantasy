import court from '../../../public/luna-v16/grand/art/game-motion/court/cards.json';

export function fantasyCourtBack(index: number, original?: string): string {
  const grandOriginal = '/luna-v16/grand/art/game-motion/court/verso-' + index + '.webp';
  const current = court.backs[index];
  return current && current !== grandOriginal ? current : original || grandOriginal;
}

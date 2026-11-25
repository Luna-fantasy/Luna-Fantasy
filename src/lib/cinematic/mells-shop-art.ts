import { reviewedArtwork } from './reviewed-artwork';
import collection from './mells-shop-art.json';

type ImageSlot = 'thumb' | 'detail';
type ShopItem = Readonly<{ id: string; type: string; imageUrl: string }>;
type RegisteredImage = Readonly<{ id: string; source: string; profile: string; rank: string; thumb?: string; detail?: string }>;
const bySource = new Map<string, RegisteredImage>(collection.map(item => [item.source, item]));

/** Applies to the public storefront only; ownership, prices and equipped images use the original item. */
export function mellsShopImage(item: ShopItem, night: boolean | undefined, size: ImageSlot): string {
  if (!night) return item.imageUrl;
  const entry = bySource.get(item.imageUrl);
  if (!entry || (item.type !== 'profile' && item.type !== 'rank') || item.id !== entry[item.type]) return item.imageUrl;
  return reviewedArtwork(entry.id)?.[size] ?? entry[size] ?? item.imageUrl;
}

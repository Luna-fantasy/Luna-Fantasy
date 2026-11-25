/** Presentation only. Server route props carry the same choice through hydration. */
export function cinematicPresentationEnabled(): boolean {
  const env = process.env;
  const flag = env.NEXT_PUBLIC_LUNA_CINEMATIC;
  return flag === undefined || flag === '1';
}

/** A configured Grand switch is independent of the global presentation default. */
export function grandBookPresentationEnabled(cinematic = cinematicPresentationEnabled()): boolean {
  const flag = process.env.LUNA_GRAND_BOOK_V16;
  return flag === undefined ? cinematic : flag === '1';
}

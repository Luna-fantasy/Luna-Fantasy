/** The isolated V19 preview reads fixture corrections immediately after local Mongo writes. */
export function previewCatalogIsLive(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.NODE_ENV === 'development' && env.LUNA_DEV_V19_VISUAL_FIXES === '1';
}

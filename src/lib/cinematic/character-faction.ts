/** Public display aliases for old character faction slugs. Never rewrites stored documents. */
export function canonicalCharacterFaction(id: string): string {
  switch (id) {
    case 'moon': return 'moon-creatures';
    case 'strange': return 'strange-being';
    default: return id;
  }
}

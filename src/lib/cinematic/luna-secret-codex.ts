import approved from './luna-secret-codex-data.json';
import { projectLunaCardArtwork, type ReleaseCardArt } from '../release-card-art';
import { inspectorArtworkViewerSrc } from './native-art-inspector';

type ReadingLocale = 'en' | 'ar';
type CodexPair = Readonly<{ label: string; text: string }>;
type CodexCopy = Readonly<{
  name: string;
  value: number | string;
  lore: string;
  schema?: string | null;
  facts: readonly CodexPair[];
  margin: readonly CodexPair[];
}>;

export type LunaSecretCodexSelection = Readonly<{
  releaseId: ReleaseCardArt['releaseId'];
  artwork: Readonly<{ detail: string; preferred?: string }>;
  reading: Readonly<Omit<CodexCopy, 'schema'> & { lang: ReadingLocale; schema: string }>;
}>;

const approvedById = new Map<string, Readonly<CodexCopy & { ar: CodexCopy }>>(
  approved.map(entry => [entry.id, entry] as const),
);

export const lunaSecretCodexLabels = {
  en: {
    open: 'Read the Secret Codex', card: 'Open the Secret card', label: 'Secret Codex',
    value: 'Card value', schema: 'Inscription', facts: 'Field notes', margin: 'Marginalia',
    close: 'Close', unavailable: 'The approved card artwork could not be loaded.',
  },
  ar: {
    open: 'اقرأ سجل الكرت السري', card: 'افتح الكرت السري', label: 'السجل السري',
    value: 'قيمة الكرت', schema: 'النقش', facts: 'ملاحظات ميدانية', margin: 'هوامش',
    close: 'إغلاق', unavailable: 'تعذّر عرض صورة الكرت المعتمدة.',
  },
} as const;

/**
 * Join transcription only after the existing approved artwork projection has verified the live
 * card's exact versioned source, stable display name and rank. Release IDs are not DB identities.
 * The reader intentionally receives no old-source URL or gameplay data.
 */
export function projectLunaSecretCodex(
  card: Parameters<typeof projectLunaCardArtwork>[0],
  locale: ReadingLocale,
  cinematic: boolean,
): LunaSecretCodexSelection | undefined {
  const art = projectLunaCardArtwork(card, cinematic);
  if (!art) return;
  const row = approvedById.get(art.releaseId);
  if (!row) return;

  const copy = locale === 'ar' ? row.ar : row;
  const { name, lore, schema, value, facts, margin } = copy;
  return {
    releaseId: art.releaseId,
    artwork: { detail: art.detail, preferred: inspectorArtworkViewerSrc(art.releaseId) },
    reading: { lang: locale, name, lore, schema: schema ?? '', value, facts, margin },
  };
}

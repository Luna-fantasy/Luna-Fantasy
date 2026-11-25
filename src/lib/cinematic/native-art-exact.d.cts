import type { VerifiedNativeArtwork } from './native-art-url';
export type HistoricalArtworkExpectation = {
  sha256: string;
  width: number;
  height: number;
  surface: string;
  revision: string;
};
export function rowMatchesExpected(id: string, expected: HistoricalArtworkExpectation | undefined, row: VerifiedNativeArtwork | undefined): boolean;
export function readExactSource(root: string | undefined, id: string, expected: HistoricalArtworkExpectation | undefined, row: VerifiedNativeArtwork | undefined): Buffer;

type ReviewDimensionException = {
  historicalWidth: number;
  historicalHeight: number;
  dimensionNote: string;
};
/** Null means normal historical grid; undefined means rejected. */
export function reviewDimensions(id: string, history: { sha256: string; width: number; height: number }, candidateSha256: string, width: number, height: number): ReviewDimensionException | null | undefined;

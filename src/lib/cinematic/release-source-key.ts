/** Mongo records can store literal spaces in CDN paths whose release pins use %20. */
export function releaseSourceKey(source: string | null | undefined): string {
  return source?.replace(/ /g, '%20') ?? '';
}

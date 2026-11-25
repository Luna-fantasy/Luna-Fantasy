interface PublicCatalog {
  luckboxTiers: unknown;
  stoneBox: unknown;
  ticketPackages: unknown;
  lunariPackages: unknown;
  merchants?: unknown;
}

interface GuestSnapshot {
  body: string;
  expiresAt: number;
}

// Serialize the public fields only. A guest response must never carry a member's balance or permissions.
export function snapshotGuestCatalog(catalog: PublicCatalog, expiresAt: number): GuestSnapshot {
  const { luckboxTiers, stoneBox, ticketPackages, lunariPackages, merchants } = catalog;
  return {
    body: JSON.stringify({ luckboxTiers, stoneBox, ticketPackages, lunariPackages, merchants }),
    expiresAt,
  };
}

export function readGuestCatalog(snapshot: GuestSnapshot | undefined, now: number): string | null {
  return snapshot && now < snapshot.expiresAt ? snapshot.body : null;
}

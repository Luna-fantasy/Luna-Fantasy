export function dispatchBalanceUpdate(balance: number) {
  window.dispatchEvent(new CustomEvent('lunari-balance-update', { detail: { balance } }));
}

export function onBalanceUpdate(callback: (balance: number) => void): () => void {
  const handler = (e: Event) => callback((e as CustomEvent).detail.balance);
  window.addEventListener('lunari-balance-update', handler);
  return () => window.removeEventListener('lunari-balance-update', handler);
}

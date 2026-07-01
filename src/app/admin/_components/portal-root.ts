// Shared portal-target resolver for admin dashboard modals/overlays.
//
// Portals previously mounted to `document.body`, which escaped the
// `.admin-v2-shell` scope and lost every CSS custom property + font
// declaration defined on the shell — so CmdK, PlayerPeek, and the
// PendingActionPill rendered with wrong colours/typography.
//
// `layout.tsx` renders a `<div id="admin-portal-root" />` as the last
// child of the shell. This helper returns that node when available, or
// falls back to `document.body` for safety during hydration edge cases.
export function getAdminPortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById('admin-portal-root') ?? document.body;
}

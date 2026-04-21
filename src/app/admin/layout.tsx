import { cookies } from 'next/headers';
import { requireMastermind } from '@/lib/admin/auth';
import Sidebar from './_components/Sidebar';
import Topbar from './_components/Topbar';
import Atmosphere from './_components/Atmosphere';
import { ToastProvider } from './_components/Toast';
import Shortcuts from './_components/Shortcuts';
import { PeekProvider } from './_components/PeekProvider';
import PlayerPeek from './_components/PlayerPeek';
import { CmdKProvider } from './_components/CmdKProvider';
import CmdK from './_components/CmdK';
import { UndoProvider } from './_components/UndoProvider';
import UndoDrawer from './_components/UndoDrawer';
import { PendingActionProvider } from './_components/PendingActionProvider';
import PendingActionPill from './_components/PendingActionPill';
import { GuildDataProvider } from './_components/GuildDataProvider';
import ErrorBoundary from './_components/ErrorBoundary';
import SpotlightCursor from './_components/SpotlightCursor';
import AvPageFooter from './_components/AvPageFooter';
import { TimezoneProvider } from './_components/TimezoneProvider';
import { decodeTheme, effectiveTheme, THEME_COOKIE } from './_components/theme-cookie';
import '@/styles/admin-v2.css';

export const metadata = {
  title: 'Luna Admin · v2',
  robots: { index: false, follow: false },
};

export default async function AdminV2Layout({ children }: { children: React.ReactNode }) {
  const session = await requireMastermind();
  const cookieStore = cookies();
  const themeState = decodeTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <ToastProvider>
      <TimezoneProvider>
      <PeekProvider>
        <CmdKProvider>
          <UndoProvider>
            <PendingActionProvider>
            <GuildDataProvider>
              <div
                className="admin-v2-shell"
                data-theme={effectiveTheme(themeState)}
                data-density={themeState.density}
                data-ritual={String(themeState.ritual)}
                data-motion={themeState.motion ? 'on' : 'off'}
              >
                <Atmosphere />
                <Sidebar
                  user={{
                    name: session.user.globalName || session.user.username || 'Mastermind',
                    image: session.user.image ?? undefined,
                  }}
                />
                <Topbar
                  initialTheme={themeState}
                  self={{
                    id: session.user.discordId ?? session.user.id ?? 'unknown',
                    name: session.user.globalName || session.user.username || 'Mastermind',
                  }}
                />
                <main className="av-main">
                  <ErrorBoundary>{children}</ErrorBoundary>
                  <AvPageFooter />
                </main>
                <SpotlightCursor />
                <Shortcuts />
                <PlayerPeek />
                <CmdK />
                <UndoDrawer />
                <PendingActionPill />
              </div>
            </GuildDataProvider>
            </PendingActionProvider>
          </UndoProvider>
        </CmdKProvider>
      </PeekProvider>
      </TimezoneProvider>
    </ToastProvider>
  );
}

import { requireMastermind } from '@/lib/admin/auth';
import AdminSidebar from './components/AdminSidebar';
import AdminCsrfInit from './components/AdminCsrfInit';
import AdminParticles from './components/AdminParticles';
import Breadcrumbs from './components/Breadcrumbs';
import { ToastProvider } from './components/Toast';

export const metadata = {
  title: 'Luna Admin Dashboard',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireMastermind();

  return (
    <ToastProvider>
      <div className="admin-layout">
        <a href="#admin-main-content" className="admin-skip-link">Skip to content</a>
        <div className="admin-particles-container" id="admin-particles" aria-hidden="true" />
        <AdminParticles />
        <AdminSidebar
          user={{
            username: session.user.username,
            globalName: session.user.globalName,
            image: session.user.image ?? undefined,
          }}
        />
        <AdminCsrfInit />
        <main className="admin-content" id="admin-main-content">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

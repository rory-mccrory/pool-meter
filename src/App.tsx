import { AccountDetail } from './pages/AccountDetail';
import { Dashboard } from './pages/Dashboard';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';
import { href, useRoute, type Route } from './router';
import { useStore } from './state';

const NAV: { label: string; route: Route }[] = [
  { label: 'Dashboard', route: { page: 'dashboard' } },
  { label: 'Import', route: { page: 'import' } },
  { label: 'Settings', route: { page: 'settings' } },
];

export function App() {
  const route = useRoute();
  const { warning } = useStore();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <a href={href({ page: 'dashboard' })} className="flex items-center gap-2 font-semibold">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6" />
            Pool Meter
          </a>
          <nav aria-label="Main" className="flex gap-1 text-sm">
            {NAV.map((n) => {
              const active = n.route.page === route.page || (route.page === 'account' && n.route.page === 'dashboard');
              return (
                <a key={n.label} href={href(n.route)} aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-3 py-1.5 ${active ? 'bg-slate-100 font-medium dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  {n.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {warning && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {warning}
          </div>
        )}
        {route.page === 'dashboard' && <Dashboard />}
        {route.page === 'account' && <AccountDetail id={route.id} />}
        {route.page === 'import' && <ImportPage key={route.accountId ?? ''} accountId={route.accountId} />}
        {route.page === 'settings' && <SettingsPage />}
      </main>
      <footer className="muted mx-auto max-w-6xl px-4 pb-8 text-xs">
        Local-only. No accounts, no tracking, nothing transmitted. Estimates are approximations of undisclosed vendor limits.
      </footer>
    </div>
  );
}

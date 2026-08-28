import { Component, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation, useSearchParams } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { useTheme } from './lib/theme.js';
import Login from './pages/Login.jsx';
import {
  IconHome, IconList, IconPeople, IconSavings, IconGear, IconPlus,
  IconChevronLeft, IconChevronRight, IconSun, IconMoon, IconAuto,
  IconCloudOff, IconSync, IconAlert, IconCheck,
} from './components/Icons.jsx';
import AddSheet from './components/AddSheet.jsx';
import MonthSheet from './components/MonthSheet.jsx';
import Home from './pages/Home.jsx';
import Transactions from './pages/Transactions.jsx';
import People from './pages/People.jsx';
import Savings from './pages/Savings.jsx';
import Settings from './pages/Settings.jsx';
import Privacy from './pages/Privacy.jsx';
import { monthLabel, monthShort, shiftMonth, monthKeyNow, dayLabel } from './lib/format.js';

const TITLES = {
  '/': ['Overview', 'your money at a glance'],
  '/ledger': ['Ledger', 'everything you logged'],
  '/people': ['Borrowed & lent', 'who owes whom'],
  '/savings': ['Savings', 'money set aside'],
  '/settings': ['Settings', 'categories, budgets, data'],
};

// Only these two screens are scoped to a month, so only these two get the stepper.
const MONTH_ROUTES = ['/', '/ledger'];

function MonthPill() {
  const { month, setMonth, openMonthSheet, day } = useStore();
  const atNow = month >= monthKeyNow();

  return (
    <div className="monthpill">
      <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><IconChevronLeft /></button>
      <button className="monthpill-label" onClick={openMonthSheet} aria-label="Open calendar">
        {day ? (
          <span className="monthpill-full">{dayLabel(day)}</span>
        ) : (
          <>
            <span className="monthpill-full">{monthLabel(month)}</span>
            <span className="monthpill-short">{monthShort(month)}</span>
          </>
        )}
      </button>
      <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={atNow} aria-label="Next month"><IconChevronRight /></button>
    </div>
  );
}

const NEXT_THEME = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON = { system: <IconAuto />, light: <IconSun />, dark: <IconMoon /> };

function ThemeButton() {
  const [theme, setTheme] = useTheme();
  return (
    <button
      className="icon-btn"
      onClick={() => setTheme(NEXT_THEME[theme])}
      aria-label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}`}
      title={`Theme: ${theme}`}
    >
      {THEME_ICON[theme]}
    </button>
  );
}

function TopBar() {
  const { pathname } = useLocation();
  const { online, pending } = useStore();
  const [title, sub] = TITLES[pathname] || TITLES['/'];

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-id">
            <h1 className="topbar-title">{title}</h1>
            <p className="topbar-sub">{sub}</p>
          </div>
          <div className="topbar-actions">
            {MONTH_ROUTES.includes(pathname) && <MonthPill />}
            <ThemeButton />
          </div>
        </div>
      </header>

      {!online && (
        <div className="banner banner--warn">
          <IconCloudOff />
          <span>Offline — entries you add are saved on this device{pending ? ` (${pending} waiting)` : ''}.</span>
        </div>
      )}
      {online && pending > 0 && (
        <div className="banner">
          <IconSync />
          <span>Syncing {pending} saved {pending === 1 ? 'entry' : 'entries'}…</span>
        </div>
      )}
    </>
  );
}

// Sits below every route, so the attribution shows on all screens rather than
// only the dashboard.
function AppFooter() {
  return (
    <footer className="app-footer">
      <div>Maintained &amp; developed by <span className="brand">Avita Technologies</span></div>
      <div className="ver">
        My Hisab · v{__APP_VERSION__} · <Link className="linkish" to="/privacy-policy">Privacy</Link>
      </div>
    </footer>
  );
}

const NAV = [
  ['/', 'Home', IconHome],
  ['/ledger', 'Ledger', IconList],
  ['/people', 'People', IconPeople],
  ['/savings', 'Savings', IconSavings],
  ['/settings', 'More', IconGear],
];

function Nav() {
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <span className="nav-ico"><Icon /></span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// Home-screen shortcuts arrive as ?add=expense — open the sheet, then clean the URL.
function ShortcutHandler() {
  const [params, setParams] = useSearchParams();
  const { openAdd } = useStore();
  useEffect(() => {
    const kind = params.get('add');
    if (kind) {
      openAdd({ kind });
      params.delete('add');
      setParams(params, { replace: true });
    }
  }, [params, openAdd, setParams]);
  return null;
}

function ScrollTop() {
  const { pathname } = useLocation();
  // Block body on purpose: an effect must return a cleanup function or nothing at all.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[hisab] render error', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-ico empty-ico--warn"><IconAlert /></div>
          <div className="empty-t">Something broke on this screen</div>
          <div className="empty-s">{this.state.error.message}</div>
          <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}

function Shell() {
  const { addSheet, openAdd, toast, monthSheet } = useStore();
  return (
    <div className="app">
      <ScrollTop />
      <ShortcutHandler />
      <TopBar />
      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ledger" element={<Transactions />} />
            <Route path="/people" element={<People />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
          <AppFooter />
        </ErrorBoundary>
      </main>

      <button className="fab" onClick={() => openAdd({})} aria-label="Add entry">
        <IconPlus />
        <span className="fab-label">Add</span>
      </button>
      <Nav />

      {addSheet && <AddSheet key={addSheet.tx?._id || addSheet.kind || 'new'} />}
      {monthSheet && <MonthSheet />}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-ico"><IconCheck /></span>{toast}
        </div>
      )}
    </div>
  );
}

// Nothing renders until we know whether there is a session, so the app never
// flashes someone's dashboard before bouncing them to sign in.
function Gate() {
  const { user, checking } = useAuth();
  if (checking) {
    return (
      <div className="boot">
        <div className="boot-mark">₹</div>
        <div className="skel" style={{ width: 140, height: 10, borderRadius: 6 }} />
      </div>
    );
  }
  if (!user) return <Login />;
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public: a privacy policy you can only read once you have handed over
            your details is no use, and Google's consent screen must reach it. */}
        <Route path="/privacy-policy" element={<Privacy />} />
        <Route
          path="*"
          element={(
            <AuthProvider>
              <Gate />
            </AuthProvider>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

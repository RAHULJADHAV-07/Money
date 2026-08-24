import { Component, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import { IconHome, IconList, IconPeople, IconPiggy, IconGear } from './components/Icons.jsx';
import AddSheet from './components/AddSheet.jsx';
import Home from './pages/Home.jsx';
import Transactions from './pages/Transactions.jsx';
import People from './pages/People.jsx';
import Savings from './pages/Savings.jsx';
import Settings from './pages/Settings.jsx';

const TITLES = {
  '/': ['My Hisab', 'your money at a glance'],
  '/ledger': ['Transactions', 'everything you logged'],
  '/people': ['Borrowed & lent', 'who owes whom'],
  '/savings': ['Savings', 'money set aside'],
  '/settings': ['Settings', 'categories, budgets, data'],
};

function TopBar() {
  const { pathname } = useLocation();
  const { online, pending } = useStore();
  const [title, sub] = TITLES[pathname] || TITLES['/'];

  return (
    <>
      <header className="topbar">
        <div>
          <h1>{title}</h1>
          <div className="sub">{sub}</div>
        </div>
      </header>
      {!online && (
        <div className="banner">
          ● Offline — entries you add are saved on this device{pending ? ` (${pending} waiting)` : ''}.
        </div>
      )}
      {online && pending > 0 && <div className="banner">↑ Syncing {pending} saved {pending === 1 ? 'entry' : 'entries'}…</div>}
    </>
  );
}

function Nav() {
  const items = [
    ['/', 'Home', IconHome],
    ['/ledger', 'Ledger', IconList],
    ['/people', 'People', IconPeople],
    ['/savings', 'Savings', IconPiggy],
    ['/settings', 'More', IconGear],
  ];
  return (
    <nav className="nav">
      {items.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon />
          <span>{label}</span>
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
          <div className="big">!</div>
          <div className="t">Something broke on this screen</div>
          <div className="s">{this.state.error.message}</div>
          <button className="btn btn-in btn-sm" style={{ marginTop: 14 }}
                  onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}

function Shell() {
  const { addSheet, openAdd, toast } = useStore();
  return (
    <div className="app">
      <ScrollTop />
      <ShortcutHandler />
      <TopBar />
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ledger" element={<Transactions />} />
        <Route path="/people" element={<People />} />
        <Route path="/savings" element={<Savings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </ErrorBoundary>
      <button className="fab" onClick={() => openAdd({})} aria-label="Add entry">+</button>
      <Nav />
      {addSheet && <AddSheet key={addSheet.tx?._id || addSheet.kind || 'new'} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// Nothing renders until we know whether there is a session, so the app never
// flashes someone's dashboard before bouncing them to sign in.
function Gate() {
  const { user, checking } = useAuth();
  if (checking) {
    return (
      <div className="auth-loading">
        <div className="skeleton" style={{ width: 180, height: 14, borderRadius: 7 }} />
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
  useEffect(() => {
    const saved = localStorage.getItem('hisab.theme');
    if (saved && saved !== 'system') document.documentElement.setAttribute('data-theme', saved);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}

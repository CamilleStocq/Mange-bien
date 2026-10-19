import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { generateWeekIfEmpty, useApp, useData } from './store/store';
import { useRoute, type Route } from './lib/router';
import { addDays, todayISO, weekStart } from './lib/dates';
import { Icon, ToastHost } from './components/ui';
import { Today } from './pages/Today';
import { CalendarPage, DayPage } from './pages/Calendar';
import { FoodPage } from './pages/Food';
import { RecipeEditor, RecipePage } from './pages/Recipe';
import { BatchPage } from './pages/Batch';
import { ShoppingPage } from './pages/Shopping';
// Pages avec graphiques chargées à la demande (bibliothèque de graphiques plus lourde)
const SportPage = lazy(() => import('./pages/Sport').then((m) => ({ default: m.SportPage })));
const ProgressPage = lazy(() => import('./pages/Progress').then((m) => ({ default: m.ProgressPage })));
import { DataPage, HydrationPage, IngredientsPage, SchedulePage, SettingsPage } from './pages/Settings';
import { IphoneHelpPage, NotificationsPage } from './pages/Notifications';
import { Onboarding } from './pages/Onboarding';

const TABS = [
  { href: '#/aujourdhui', match: ['aujourdhui', 'hydratation', 'reglages'], icon: 'home', label: 'Aujourd’hui' },
  { href: '#/calendrier', match: ['calendrier', 'jour'], icon: 'calendar', label: 'Calendrier' },
  { href: '#/alimentation', match: ['alimentation', 'recette', 'recette-nouvelle', 'batch', 'courses'], icon: 'food', label: 'Alimentation' },
  { href: '#/sport', match: ['sport'], icon: 'sport', label: 'Sport' },
  { href: '#/progression', match: ['progression'], icon: 'chart', label: 'Progression' }
];

function page(route: Route): ReactNode {
  const [a, b, c] = route.parts;
  switch (a) {
    case 'aujourdhui': return <Today />;
    case 'calendrier': return <CalendarPage key={route.query.toString()} route={route} />;
    case 'jour': return <DayPage key={b} date={b} />;
    case 'alimentation': return <FoodPage key={route.query.toString()} route={route} />;
    case 'recette': return c === 'modifier' ? <RecipeEditor key={b} id={b} /> : <RecipePage key={b} id={b} />;
    case 'recette-nouvelle': return <RecipeEditor key="new" />;
    case 'batch': return <BatchPage key={route.query.toString()} route={route} />;
    case 'courses': return <ShoppingPage key={route.query.toString()} route={route} />;
    case 'sport': return <SportPage key={route.query.toString()} route={route} />;
    case 'progression': return <ProgressPage />;
    case 'hydratation': return <HydrationPage />;
    case 'reglages':
      if (b === 'notifications') return <NotificationsPage />;
      if (b === 'iphone') return <IphoneHelpPage />;
      if (b === 'horaires') return <SchedulePage />;
      if (b === 'ingredients') return <IngredientsPage />;
      if (b === 'donnees') return <DataPage />;
      return <SettingsPage />;
    default: return <Today />;
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="card tint-warn">
            <h2>Oups, cet écran a rencontré un problème</h2>
            <p className="small">Tes données sont conservées. Tu peux revenir à l’accueil ou recharger l’application.</p>
            <p className="tiny muted">{this.state.error.message}</p>
            <div className="row">
              <a className="btn" href="#/aujourdhui" onClick={() => this.setState({ error: undefined })}>Accueil</a>
              <button className="btn secondary" onClick={() => location.reload()}>Recharger</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  return online;
}

export function App() {
  const route = useRoute();
  const hydrated = useApp((s) => s.hydrated);
  const storageError = useApp((s) => s.storageError);
  const onboardingDone = useData((d) => d.onboardingDone);
  const online = useOnline();

  // Le planning se prolonge tout seul : semaine en cours et suivante générées si elles sont vides.
  useEffect(() => {
    if (!hydrated || !onboardingDone) return;
    const monday = weekStart(todayISO());
    generateWeekIfEmpty(monday);
    generateWeekIfEmpty(addDays(monday, 7));
  }, [hydrated, onboardingDone, route.path]);

  if (!hydrated) return <div className="page"><p className="muted">Chargement…</p></div>;
  const onOnboarding = route.parts[0] === 'bienvenue' || !onboardingDone;
  if (onOnboarding && !onboardingDone) {
    return (
      <div className="app" style={{ paddingBottom: 24 }}>
        <Onboarding />
        <ToastHost />
      </div>
    );
  }
  const current = TABS.find((t) => t.match.includes(route.parts[0] ?? 'aujourdhui')) ?? TABS[0];
  return (
    <div className="app" data-section={current.href.slice(2)}>
      {(storageError || !online) && (
        <div className="page" style={{ paddingBottom: 0 }}>
          {storageError && <div className="alert-banner" role="alert">{storageError}</div>}
          {!online && <div className="alert-banner">Hors connexion : tout reste consultable et modifiable ; les rappels seront synchronisés au retour du réseau.</div>}
        </div>
      )}
      <ErrorBoundary key={route.path}>
        <main><Suspense fallback={<div className="page"><p className="muted">Chargement…</p></div>}>{page(route)}</Suspense></main>
      </ErrorBoundary>
      <nav className="bottom-nav" aria-label="Navigation principale">
        <ul>
          {TABS.map((t) => (
            <li key={t.href}>
              <a href={t.href} aria-current={t === current ? 'page' : undefined}>
                <span className="nav-ico"><Icon name={t.icon} /></span>
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <ToastHost />
    </div>
  );
}

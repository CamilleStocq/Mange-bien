import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { loadData } from './store/store';
import { startAutoSync } from './lib/push';
import '@fontsource-variable/outfit/wght.css';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

loadData().then(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  startAutoSync();
});

// Service worker : fonctionnement hors ligne et réception des notifications push.
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

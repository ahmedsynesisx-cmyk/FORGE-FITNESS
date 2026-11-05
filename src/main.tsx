import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { VaultProvider } from './lib/vault-context';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VaultProvider>
      <App />
    </VaultProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

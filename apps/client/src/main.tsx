import '@medicalfield/design/index.css';
import './ui/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { syncEngine } from './sync/engine';

// Pede ao navegador para não descartar o banco local sob pressão de espaço.
void navigator.storage?.persist?.();
if (window.isSecureContext) registerSW({ immediate: true });
syncEngine.iniciar();

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <BrowserRouter basename="/app">
      <App />
    </BrowserRouter>
  </StrictMode>,
);

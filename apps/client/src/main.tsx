import '@medicalfield/design/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { syncEngine } from './sync/engine';

syncEngine.iniciar();

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <BrowserRouter basename="/app">
      <App />
    </BrowserRouter>
  </StrictMode>,
);

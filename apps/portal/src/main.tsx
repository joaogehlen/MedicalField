import '@medicalfield/design/index.css';
import './portal.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <BrowserRouter basename="/portal">
      <App />
    </BrowserRouter>
  </StrictMode>,
);

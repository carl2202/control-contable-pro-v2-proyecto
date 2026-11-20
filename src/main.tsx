import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemento raíz #root no encontrado en el DOM.');
}

const flexGapProbe = document.createElement('div');
flexGapProbe.style.display = 'flex';
flexGapProbe.style.flexDirection = 'column';
flexGapProbe.style.rowGap = '1px';
const firstProbeItem = document.createElement('div');
const secondProbeItem = document.createElement('div');
firstProbeItem.style.height = '1px';
secondProbeItem.style.height = '1px';
flexGapProbe.appendChild(firstProbeItem);
flexGapProbe.appendChild(secondProbeItem);
document.body.appendChild(flexGapProbe);
if (flexGapProbe.scrollHeight < 3) {
  document.documentElement.classList.add('no-flex-gap');
}
flexGapProbe.remove();

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('No se pudo registrar el service worker:', error);
    });
  });
}

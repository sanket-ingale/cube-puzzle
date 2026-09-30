import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import faviconSvg from './assets/favicon.svg?raw';

// The page may be served without its own <head> (e.g. packed into a single file), so make sure
// the tab shows the app's cube icon either way.
if (!document.querySelector('link[rel~="icon"]')) {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;
  document.head.appendChild(link);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

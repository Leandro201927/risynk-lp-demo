import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '../styles/tokens.css';
import '../styles/global.css';
import '../styles/story.css';
import '../styles/responsive.css';
import { App } from './App';
import { initWebVitals } from '../monitoring/webVitals';

initWebVitals();
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

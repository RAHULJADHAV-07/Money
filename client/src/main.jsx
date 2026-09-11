import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { watchKeyboard } from './lib/keyboard.js';
import { initAppearance } from './lib/appearance.js';
import './styles.css';

// Outside React: the measurement is global and must survive every re-render.
watchKeyboard();

// Before the first render, so nothing paints in the default accent first.
initAppearance();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

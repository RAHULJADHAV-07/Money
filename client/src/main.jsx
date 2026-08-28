import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { watchKeyboard } from './lib/keyboard.js';
import './styles.css';

// Outside React: the measurement is global and must survive every re-render.
watchKeyboard();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@masar/design-system/tokens/index.css';
import './styles.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

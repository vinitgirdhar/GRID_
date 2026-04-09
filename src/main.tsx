import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { WarmupProvider } from './components/WarmupProvider.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WarmupProvider>
      <App />
    </WarmupProvider>
  </StrictMode>,
);


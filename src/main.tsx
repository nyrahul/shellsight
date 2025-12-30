import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext';
import App from './App.tsx';
import './index.css';

// Early token extraction - capture OAuth callback token before React mounts
// This ensures the token is saved to localStorage before any auth effects run
if (window.location.pathname === '/auth/callback') {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem('auth_token', token);
    // Clean up URL and redirect to home
    window.history.replaceState({}, '', '/');
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);

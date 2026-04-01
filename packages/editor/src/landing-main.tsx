import React from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from './pages/landing/LandingPage';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <LandingPage />
  </React.StrictMode>
);

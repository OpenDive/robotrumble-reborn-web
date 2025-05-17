// Main application entry point
import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui-layer/App';

// Import Tailwind styles
import './ui-layer/styles/index.css';

// Initialize React UI
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

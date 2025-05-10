// Main application entry point
import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { engine } from './engine-layer';
import App from './ui-layer/App';

// Import Tailwind styles
import './ui-layer/styles/index.css';

// Create container for engine
const engineContainer = document.createElement('div');
engineContainer.id = 'engine-container';
document.body.appendChild(engineContainer);

// Initialize the game engine
engine.initialize(engineContainer);

// Create container for React UI
const uiContainer = document.createElement('div');
uiContainer.id = 'root';
document.body.appendChild(uiContainer);

// Initialize React UI
createRoot(uiContainer).render(
  <StrictMode>
    <App />
  </StrictMode>
);

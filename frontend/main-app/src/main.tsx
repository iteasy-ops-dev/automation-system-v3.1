/**
 * Main Entry Point
 * 
 * React 애플리케이션 진입점
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import './index.css';

/**
 * Mounts into the div the plugin prints. If that div is not there, the
 * page is not one of ours and nothing should happen.
 */
const host = document.getElementById('ah-app');
if (host) {
  createRoot(host).render(<App />);
}

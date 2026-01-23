import React from 'react';
import ReactDOM from 'react-dom/client';
// Use the new redesigned UI with Home-first design and Chat/Compare tabs
import SidePanelApp from './AppRedesigned';
import '../styles/globals.css';

// Import glass themes
import '../theme/glass.css';
import '../theme/glass-premium.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>
);

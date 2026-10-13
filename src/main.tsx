import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
import './theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthGate /></React.StrictMode>);

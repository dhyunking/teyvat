import { hydrateRoot } from 'react-dom/client';
import { createApp } from './app.js';
import { parseRoute } from './seo.js';

// Keep the generated HTML visible until React attaches the original interactions.
hydrateRoot(document.getElementById('dc-root'), createApp(document, parseRoute(location.pathname)));

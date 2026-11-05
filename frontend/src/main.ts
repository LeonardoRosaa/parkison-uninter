import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
if (posthogKey) {
  // Loaded as a separate chunk so the SDK does not delay the first render.
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      defaults: '2026-08-30',
      capture_exceptions: true,
      // The analysis page shows a health result; keep its text out of replays.
      session_recording: { maskTextSelector: '.analysis' }
    });
  });
}

const target = document.getElementById('app');
if (!target) {
  throw new Error('App root element "#app" was not found.');
}

const app = mount(App, { target });

export default app;

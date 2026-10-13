// @ts-check
import { defineConfig, sessionDrivers } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  site: 'https://arrivly.com.au',
  // Keep every existing page pre-rendered. Only routes that explicitly export
  // `prerender = false` (the job-analysis endpoint) run in Cloudflare Workers.
  output: 'static',
  adapter: cloudflare({
    // Preserve the existing Node-based static build while the one on-demand
    // endpoint runs in Cloudflare's workerd runtime.
    prerenderEnvironment: 'node',
    imageService: 'compile',
  }),
  // This phase adds no authentication or persistence. An explicit null driver
  // prevents the Cloudflare adapter from provisioning an unused KV database.
  session: {
    driver: sessionDrivers.null(),
  },
  // Deterministic URLs — canonical tags and sitemap use the no-trailing-slash form.
  trailingSlash: 'never',
  integrations: [sitemap(), preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});

// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE,
  base: process.env.BASE,
  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()]
  }
});
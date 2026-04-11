// @ts-check
import { defineConfig } from "astro/config";

import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";

const env =
  /** @type {{ process?: { env?: { SITE?: string; BASE?: string } } }} */ (globalThis).process
    ?.env ?? {};

// https://astro.build/config
export default defineConfig({
  site: env.SITE,
  base: env.BASE,
  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()],
  },
});

import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://moldtestingexperts.com',
  integrations: [
    tailwind(),
    sitemap()
  ],
  output: 'static',
  vite: {
    ssr: {
      noExternal: ['@sfw/content', '@sfw/ui', '@sfw/utils', '@sfw/config'],
    },
  },
});

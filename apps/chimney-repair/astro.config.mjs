import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { siteRedirects } from '../../packages/content/src/redirects';

const redirects = siteRedirects['chimney-repair'] ?? {};
const redirectSources = new Set(Object.keys(redirects));

export default defineConfig({
  site: 'https://woodchimneyrepair.com',
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return !redirectSources.has(path);
      },
    })
  ],
  output: 'static',
  redirects,
  vite: {
    ssr: {
      noExternal: ['@sfw/content', '@sfw/ui', '@sfw/utils', '@sfw/config'],
    },
  },
});

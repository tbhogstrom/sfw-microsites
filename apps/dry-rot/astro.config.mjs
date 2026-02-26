import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://rotrepairportland.com',
  integrations: [
    tailwind(),
    sitemap()
  ],
  output: 'static',
  adapter: vercel(),
  security: {
    checkOrigin: false
  }
});

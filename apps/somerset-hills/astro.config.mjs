import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  // Replace with the production domain once registered.
  site: 'https://somersethillsconstruction.com',
  integrations: [tailwind()],
  output: 'static',
});

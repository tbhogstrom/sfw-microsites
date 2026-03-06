import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://leakingwindow.com',
  integrations: [
    tailwind(),
    sitemap()
  ],
  output: 'static',
  redirects: {
    '/services/portland/bay-window-leak-repair': '/services/portland/bay-window-specialty-window-repairs',
    '/services/seattle/bay-window-leak-repair':  '/services/seattle/bay-window-specialty-window-repairs',
    '/services/portland/door-threshold-leak-repair': '/services/portland/door-frame-leak-rot-repair',
    '/services/seattle/door-threshold-leak-repair':  '/services/seattle/door-frame-leak-rot-repair',
    '/services/portland/leaking-door-frame-repair': '/services/portland/door-frame-leak-rot-repair',
    '/services/seattle/leaking-door-frame-repair':  '/services/seattle/door-frame-leak-rot-repair',
    '/services/portland/leaking-window-repair-and-waterproofing': '/services/portland/window-leak-repair-waterproofing',
    '/services/seattle/leaking-window-repair-and-waterproofing':  '/services/seattle/window-leak-repair-waterproofing',
    '/services/portland/siding-and-window-integration-repair': '/services/portland/siding-building-envelope-integration',
    '/services/seattle/siding-and-window-integration-repair':  '/services/seattle/siding-building-envelope-integration',
    '/services/portland/sliding-glass-door-leak-repair': '/services/portland/sliding-glass-door-leak-repair',
    '/services/seattle/sliding-glass-door-leak-repair':  '/services/seattle/sliding-glass-door-leak-repair',
    '/services/portland/window-flashing-repair-and-installation': '/services/portland/window-flashing-repair',
    '/services/seattle/window-flashing-repair-and-installation':  '/services/seattle/window-flashing-repair',
    '/services/portland/window-frame-rot-repair-and-replacement': '/services/portland/window-door-frame-rot-repair',
    '/services/seattle/window-frame-rot-repair-and-replacement':  '/services/seattle/window-door-frame-rot-repair',
    '/services/portland/window-seal-replacement-and-reglazing': '/services/portland/window-leak-repair-waterproofing',
    '/services/seattle/window-seal-replacement-and-reglazing':  '/services/seattle/window-leak-repair-waterproofing',
    '/services/portland/window-sill-leak-repair': '/services/portland/window-leak-repair-waterproofing',
    '/services/seattle/window-sill-leak-repair':  '/services/seattle/window-leak-repair-waterproofing',
  },
});

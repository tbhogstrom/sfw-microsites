import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sidingrepairexperts.com',
  integrations: [
    tailwind(),
    sitemap()
  ],
  output: 'static',
  redirects: {
    '/services/portland/aluminum-siding-repair': '/services/portland/lap-cedar-wood-specialty-siding-repair',
    '/services/seattle/aluminum-siding-repair':  '/services/seattle/lap-cedar-wood-specialty-siding-repair',
    '/services/portland/custom-siding-solutions': '/services/portland/siding-integration-repairs',
    '/services/seattle/custom-siding-solutions':  '/services/seattle/siding-integration-repairs',
    '/services/portland/emergency-siding-repairs': '/services/portland/siding-rot-repair-replacement',
    '/services/seattle/emergency-siding-repairs':  '/services/seattle/siding-rot-repair-replacement',
    '/services/portland/fibercement-siding-installation': '/services/portland/hardie-fiber-cement-siding-repair',
    '/services/seattle/fibercement-siding-installation':  '/services/seattle/hardie-fiber-cement-siding-repair',
    '/services/portland/siding-installation-for-new-construction': '/services/portland/siding-rot-repair-replacement',
    '/services/seattle/siding-installation-for-new-construction':  '/services/seattle/siding-rot-repair-replacement',
    '/services/portland/siding-maintenance-and-inspection': '/services/portland/siding-rot-repair-replacement',
    '/services/seattle/siding-maintenance-and-inspection':  '/services/seattle/siding-rot-repair-replacement',
    '/services/portland/siding-painting-and-finishing': '/services/portland/siding-trim-corner-board-repair',
    '/services/seattle/siding-painting-and-finishing':  '/services/seattle/siding-trim-corner-board-repair',
    '/services/portland/siding-repair-for-storm-damage': '/services/portland/siding-rot-repair-replacement',
    '/services/seattle/siding-repair-for-storm-damage':  '/services/seattle/siding-rot-repair-replacement',
    '/services/portland/vinyl-siding-replacement': '/services/portland/lap-cedar-wood-specialty-siding-repair',
    '/services/seattle/vinyl-siding-replacement':  '/services/seattle/lap-cedar-wood-specialty-siding-repair',
    '/services/portland/wood-siding-repair': '/services/portland/lap-cedar-wood-specialty-siding-repair',
    '/services/seattle/wood-siding-repair':  '/services/seattle/lap-cedar-wood-specialty-siding-repair',
  },
});

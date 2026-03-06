import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://flashingrepairs.com',
  integrations: [
    tailwind(),
    sitemap()
  ],
  output: 'static',
  redirects: {
    '/services/portland/chimney-flashing-repair': '/services/portland/chimney-flashing-repair',
    '/services/seattle/chimney-flashing-repair':  '/services/seattle/chimney-flashing-repair',
    '/services/portland/counterflashing-installation': '/services/portland/chimney-flashing-repair',
    '/services/seattle/counterflashing-installation':  '/services/seattle/chimney-flashing-repair',
    '/services/portland/counterflashing-repair-services': '/services/portland/chimney-flashing-repair',
    '/services/seattle/counterflashing-repair-services':  '/services/seattle/chimney-flashing-repair',
    '/services/portland/custom-metal-flashing-fabrication': '/services/portland/roof-to-wall-penetration-flashing',
    '/services/seattle/custom-metal-flashing-fabrication':  '/services/seattle/roof-to-wall-penetration-flashing',
    '/services/portland/custom-metal-flashing-solutions': '/services/portland/roof-to-wall-penetration-flashing',
    '/services/seattle/custom-metal-flashing-solutions':  '/services/seattle/roof-to-wall-penetration-flashing',
    '/services/portland/drip-edge-flashing-installation': '/services/portland/roof-to-wall-penetration-flashing',
    '/services/seattle/drip-edge-flashing-installation':  '/services/seattle/roof-to-wall-penetration-flashing',
    '/services/portland/flashing-inspection-services': '/services/portland/building-envelope-waterproofing',
    '/services/seattle/flashing-inspection-services':  '/services/seattle/building-envelope-waterproofing',
    '/services/portland/flashing-maintenance-and-inspection-services': '/services/portland/building-envelope-waterproofing',
    '/services/seattle/flashing-maintenance-and-inspection-services':  '/services/seattle/building-envelope-waterproofing',
    '/services/portland/masonry-flashing-repair': '/services/portland/chimney-flashing-repair',
    '/services/seattle/masonry-flashing-repair':  '/services/seattle/chimney-flashing-repair',
    '/services/portland/siding-and-flashing-repair': '/services/portland/building-envelope-waterproofing',
    '/services/seattle/siding-and-flashing-repair':  '/services/seattle/building-envelope-waterproofing',
    '/services/portland/skylight-flashing-installation': '/services/portland/roof-to-wall-penetration-flashing',
    '/services/seattle/skylight-flashing-installation':  '/services/seattle/roof-to-wall-penetration-flashing',
    '/services/portland/skylight-flashing-replacement': '/services/portland/roof-to-wall-penetration-flashing',
    '/services/seattle/skylight-flashing-replacement':  '/services/seattle/roof-to-wall-penetration-flashing',
    '/services/portland/step-flashing-installation-and-repair': '/services/portland/chimney-flashing-repair',
    '/services/seattle/step-flashing-installation-and-repair':  '/services/seattle/chimney-flashing-repair',
    '/services/portland/step-flashing-repair': '/services/portland/chimney-flashing-repair',
    '/services/seattle/step-flashing-repair':  '/services/seattle/chimney-flashing-repair',
    '/services/portland/vent-pipe-flashing-repair': '/services/portland/roof-to-wall-penetration-flashing',
    '/services/seattle/vent-pipe-flashing-repair':  '/services/seattle/roof-to-wall-penetration-flashing',
    '/services/portland/wall-and-roof-junction-flashing-services': '/services/portland/roof-to-wall-penetration-flashing',
    '/services/seattle/wall-and-roof-junction-flashing-services':  '/services/seattle/roof-to-wall-penetration-flashing',
    '/services/portland/wall-flashing-repair': '/services/portland/roof-to-wall-penetration-flashing',
    '/services/seattle/wall-flashing-repair':  '/services/seattle/roof-to-wall-penetration-flashing',
  },
});

import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://woodchimneyrepair.com',
  integrations: [
    tailwind(),
    sitemap()
  ],
  output: 'static',
  redirects: {
    '/services/portland/chimney-chase-cover-installation-and-replacement': '/services/portland/chimney-chase-waterproofing-sealing',
    '/services/seattle/chimney-chase-cover-installation-and-replacement':  '/services/seattle/chimney-chase-waterproofing-sealing',
    '/services/portland/chimney-chase-crown-repair': '/services/portland/chimney-chase-structural-repair-rebuilding',
    '/services/seattle/chimney-chase-crown-repair':  '/services/seattle/chimney-chase-structural-repair-rebuilding',
    '/services/portland/chimney-chase-repair-and-rebuilding': '/services/portland/chimney-chase-structural-repair-rebuilding',
    '/services/seattle/chimney-chase-repair-and-rebuilding':  '/services/seattle/chimney-chase-structural-repair-rebuilding',
    '/services/portland/chimney-chase-water-damage-restoration': '/services/portland/chimney-chase-water-damage-rot-repair',
    '/services/seattle/chimney-chase-water-damage-restoration':  '/services/seattle/chimney-chase-water-damage-rot-repair',
    '/services/portland/chimney-flashing-repair-and-waterproofing': '/services/portland/chimney-chase-flashing-leak-repair',
    '/services/seattle/chimney-flashing-repair-and-waterproofing':  '/services/seattle/chimney-chase-flashing-leak-repair',
    '/services/portland/chimney-penetration-leak-repair': '/services/portland/chimney-chase-flashing-leak-repair',
    '/services/seattle/chimney-penetration-leak-repair':  '/services/seattle/chimney-chase-flashing-leak-repair',
    '/services/portland/roof-cricket-installation-for-chimneys': '/services/portland/chimney-chase-flashing-leak-repair',
    '/services/seattle/roof-cricket-installation-for-chimneys':  '/services/seattle/chimney-chase-flashing-leak-repair',
    '/services/portland/wood-chimney-chase-framing-repair': '/services/portland/chimney-chase-structural-repair-rebuilding',
    '/services/seattle/wood-chimney-chase-framing-repair':  '/services/seattle/chimney-chase-structural-repair-rebuilding',
    '/services/portland/wood-chimney-chase-siding-repair': '/services/portland/chimney-chase-siding-exterior-repair',
    '/services/seattle/wood-chimney-chase-siding-repair':  '/services/seattle/chimney-chase-siding-exterior-repair',
    '/services/portland/wood-chimney-exterior-finishing-and-painting': '/services/portland/chimney-chase-siding-exterior-repair',
    '/services/seattle/wood-chimney-exterior-finishing-and-painting':  '/services/seattle/chimney-chase-siding-exterior-repair',
  },
});

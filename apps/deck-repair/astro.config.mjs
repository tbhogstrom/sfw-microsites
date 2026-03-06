import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://deckrepairexpert.com',
  integrations: [
    tailwind(),
    sitemap()
  ],
  output: 'static',
  redirects: {
    '/services/portland/deck-board-replacement': '/services/portland/deck-board-repair-replacement',
    '/services/seattle/deck-board-replacement':  '/services/seattle/deck-board-repair-replacement',
    '/services/portland/deck-surface-refinishing': '/services/portland/deck-board-repair-replacement',
    '/services/seattle/deck-surface-refinishing':  '/services/seattle/deck-board-repair-replacement',
    '/services/portland/deck-staining-and-sealing': '/services/portland/deck-board-repair-replacement',
    '/services/seattle/deck-staining-and-sealing':  '/services/seattle/deck-board-repair-replacement',
    '/services/portland/epoxy-wood-repair': '/services/portland/deck-board-repair-replacement',
    '/services/seattle/epoxy-wood-repair':  '/services/seattle/deck-board-repair-replacement',
    '/services/portland/rotten-trim-repair': '/services/portland/deck-board-repair-replacement',
    '/services/seattle/rotten-trim-repair':  '/services/seattle/deck-board-repair-replacement',
    '/services/portland/deck-repair-services': '/services/portland/deck-board-repair-replacement',
    '/services/seattle/deck-repair-services':  '/services/seattle/deck-board-repair-replacement',
    '/services/portland/deck-joist-repair-and-replacement': '/services/portland/deck-structural-framing-repair',
    '/services/seattle/deck-joist-repair-and-replacement':  '/services/seattle/deck-structural-framing-repair',
    '/services/portland/pressure-treated-wood-installation': '/services/portland/deck-structural-framing-repair',
    '/services/seattle/pressure-treated-wood-installation':  '/services/seattle/deck-structural-framing-repair',
    '/services/portland/deck-drainage-solutions': '/services/portland/deck-ledger-flashing-water-protection',
    '/services/seattle/deck-drainage-solutions':  '/services/seattle/deck-ledger-flashing-water-protection',
    '/services/portland/post-replacement-and-repair': '/services/portland/deck-posts-footings-foundation',
    '/services/seattle/post-replacement-and-repair':  '/services/seattle/deck-posts-footings-foundation',
    '/services/portland/deck-lighting-installation': '/services/portland/deck-skirting-lattice-accessories',
    '/services/seattle/deck-lighting-installation':  '/services/seattle/deck-skirting-lattice-accessories',
  },
});

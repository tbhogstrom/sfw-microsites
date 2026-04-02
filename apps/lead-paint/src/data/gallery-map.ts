/**
 * Maps pages to their assigned lightbox gallery.
 * Distribution is balanced so no single gallery is overused.
 *
 * Gallery distribution:
 *   lead-paint-historic-rennovation:    services/index, stabilization-encapsulation (2)
 *   lead-paint-containment-safety:      locations/seattle, testing-inspection, containment-cleanup (3)
 *   lead-paint-full-job:                homepage, removal-surface-preparation (2)
 *   lead-paint-prep-siding-and-roof:    locations/portland, lead-safe-exterior-renovation (2)
 *   colonial-lead-paint-full-job:    locations/index, lead-safe-painting-exterior-services (2)
 */

import data from './images.json';

interface GalleryImage {
  src: string;
  alt: string;
}

interface Gallery {
  id: string;
  name: string;
  images: GalleryImage[];
}

const galleries = ((data as Record<string, unknown>).lightboxGalleries ?? []) as Gallery[];

function getGallery(id: string): Gallery | undefined {
  return galleries.find((g) => g.id === id);
}

// Page type → gallery ID mapping
const pageGalleryMap: Record<string, string> = {
  // Static pages
  homepage: 'lead-paint-full-job',
  'services-index': 'lead-paint-historic-rennovation',
  'locations-index': 'colonial-lead-paint-full-job',

  // Location pages
  'location:portland': 'lead-paint-prep-siding-and-roof',
  'location:seattle': 'lead-paint-containment-safety',

  // Service pages (same gallery for both portland and seattle variants)
  'service:lead-paint-testing-inspection': 'lead-paint-containment-safety',
  'service:lead-paint-removal-surface-preparation': 'lead-paint-full-job',
  'service:lead-paint-containment-cleanup': 'lead-paint-containment-safety',
  'service:lead-paint-stabilization-encapsulation': 'lead-paint-historic-rennovation',
  'service:lead-safe-exterior-renovation': 'lead-paint-prep-siding-and-roof',
  'service:lead-safe-painting-exterior-services': 'colonial-lead-paint-full-job',
};

export function getPageGallery(pageKey: string): Gallery | undefined {
  const galleryId = pageGalleryMap[pageKey];
  return galleryId ? getGallery(galleryId) : undefined;
}

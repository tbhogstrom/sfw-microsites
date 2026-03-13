import type { GalleryService } from '@sfw/ui';

/**
 * Select gallery photos for a service page.
 *
 * Rules:
 * - If service has 4+ photos: randomly select 4
 * - If service has 1-3 photos: return those + random padding from same location
 * - If service has 0 photos: return 4 from random service in same location
 * - If no other services exist in location: return all current service photos (may be fewer than 4)
 *
 * @param allPhotos - All photos across all services
 * @param currentServicePhotos - Photos filtered to current service
 * @param currentLocation - Location string (portland/seattle)
 * @returns 0-4 photos to display in gallery
 */
export function selectServicePhotos(
  allPhotos: GalleryService[],
  currentServicePhotos: GalleryService[],
  currentLocation: string
): GalleryService[] {
  // If we have 4 or more photos for this service, shuffle and take 4
  if (currentServicePhotos.length >= 4) {
    return shuffleArray(currentServicePhotos).slice(0, 4);
  }

  // Get all other services in the same location
  const otherServicesInLocation = allPhotos.filter(
    (photo) => !currentServicePhotos.includes(photo) && photo.href.includes(`/services/${currentLocation}/`)
  );

  // How many photos do we need to fill the gallery?
  const needed = 4 - currentServicePhotos.length;

  if (otherServicesInLocation.length === 0) {
    // No other services in this location, return what we have
    return currentServicePhotos;
  }

  // Pick a random service and take photos from it
  const randomServicePhotos = shuffleArray(otherServicesInLocation).slice(0, needed);

  return [...currentServicePhotos, ...randomServicePhotos];
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

import { describe, it, expect } from 'vitest';
import { selectServicePhotos } from '../src/gallery';
import type { GalleryService } from '@sfw/ui';

describe('selectServicePhotos', () => {
  const portlandPhotos: GalleryService[] = [
    {
      title: 'Service A Portland 1',
      description: '',
      image: 'https://example.com/a1.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service A Portland 2',
      description: '',
      image: 'https://example.com/a2.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service A Portland 3',
      description: '',
      image: 'https://example.com/a3.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service A Portland 4',
      description: '',
      image: 'https://example.com/a4.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service A Portland 5',
      description: '',
      image: 'https://example.com/a5.jpg',
      href: '/services/portland/service-a',
    },
    {
      title: 'Service B Portland 1',
      description: '',
      image: 'https://example.com/b1.jpg',
      href: '/services/portland/service-b',
    },
    {
      title: 'Service B Portland 2',
      description: '',
      image: 'https://example.com/b2.jpg',
      href: '/services/portland/service-b',
    },
  ];

  it('returns 4 shuffled photos when service has 4+', () => {
    const result = selectServicePhotos(
      portlandPhotos,
      portlandPhotos.slice(0, 5),
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.every((p) => portlandPhotos.slice(0, 5).includes(p))).toBe(true);
  });

  it('returns all photos + padding when service has 1-3', () => {
    const currentPhotos = portlandPhotos.slice(0, 2);
    const result = selectServicePhotos(
      portlandPhotos,
      currentPhotos,
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.slice(0, 2)).toEqual(currentPhotos);
  });

  it('returns 4 from random service when current has 0', () => {
    const currentPhotos: GalleryService[] = [];
    const result = selectServicePhotos(
      portlandPhotos,
      currentPhotos,
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.every((p) => portlandPhotos.includes(p))).toBe(true);
    expect(result.every((p) => !currentPhotos.includes(p))).toBe(true);
  });

  it('returns all available when no fallback exists', () => {
    const singleServicePhotos = portlandPhotos.slice(0, 2);
    const result = selectServicePhotos(
      singleServicePhotos,
      singleServicePhotos,
      'portland'
    );
    expect(result.length).toBe(2);
    expect(result).toEqual(singleServicePhotos);
  });

  it('returns 4 photos when service has exactly 4', () => {
    const result = selectServicePhotos(
      portlandPhotos,
      portlandPhotos.slice(0, 4),
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.every((p) => portlandPhotos.slice(0, 4).includes(p))).toBe(true);
  });

  it('returns all photos when service has exactly 1', () => {
    const currentPhotos = portlandPhotos.slice(0, 1);
    const result = selectServicePhotos(
      portlandPhotos,
      currentPhotos,
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.slice(0, 1)).toEqual(currentPhotos);
  });

  it('returns all photos when service has exactly 3', () => {
    const currentPhotos = portlandPhotos.slice(0, 3);
    const result = selectServicePhotos(
      portlandPhotos,
      currentPhotos,
      'portland'
    );
    expect(result.length).toBe(4);
    expect(result.slice(0, 3)).toEqual(currentPhotos);
  });
});

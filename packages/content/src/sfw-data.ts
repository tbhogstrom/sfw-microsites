import { CompanyInfo, ServiceArea, Testimonial } from './types';

export const companyInfo: CompanyInfo = {
  name: 'SFW Construction',
  legalName: 'SFW Construction LLC',
  address: {
    street: '2552 NW Vaughn St.',
    city: 'Portland',
    state: 'OR',
    zip: '97210'
  },
  phone: '(503) 885-0236',
  email: 'info@sfwconstruction.com',
  ccbNumber: '244912'
};

export const serviceAreas: ServiceArea[] = [
  { name: 'Algona', slug: 'algona' },
  { name: 'Auburn', slug: 'auburn' },
  { name: 'Beaverton', slug: 'beaverton' },
  { name: 'Gresham', slug: 'gresham' },
  { name: 'Happy Valley', slug: 'happy-valley' },
  { name: 'Hillsboro', slug: 'hillsboro' },
  { name: 'Lake Oswego', slug: 'lake-oswego' },
  { name: 'Milwaukie', slug: 'milwaukie' },
  { name: 'Oregon City', slug: 'oregon-city' },
  { name: 'Portland', slug: 'portland' },
  { name: 'Tigard', slug: 'tigard' },
  { name: 'Tualatin', slug: 'tualatin' },
  { name: 'West Linn', slug: 'west-linn' },
  { name: 'Wilsonville', slug: 'wilsonville' },
];

export const baseTestimonials: Testimonial[] = [
  {
    quote: 'The team was professional, communicative, and did excellent work. They identified the source of the problem and fixed it properly the first time.',
    author: 'Homeowner',
    location: 'Portland, OR'
  },
  {
    quote: 'Our project wasn\'t large, but they treated it with the same care and attention as a major renovation. Very impressed with the quality and transparency.',
    author: 'Homeowner',
    location: 'Beaverton, OR'
  },
  {
    quote: 'This was a substantial project and the crew was professional throughout. Communication was excellent and our home looks stunning.',
    author: 'Homeowner',
    location: 'Portland, OR'
  }
];

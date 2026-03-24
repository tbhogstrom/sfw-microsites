export interface Stat {
  value: string;
  suffix: string;
  label: string;
}

export const companyStats: Stat[] = [
  { value: '20', suffix: '+', label: 'Years Experience' },
  { value: '1000', suffix: '+', label: 'Projects Completed' },
  { value: '99', suffix: '%', label: 'Customer Satisfaction' },
  { value: '24', suffix: '/7', label: 'Available' },
];

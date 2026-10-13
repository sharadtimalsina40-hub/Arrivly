import type { OccupationProfile } from '../types';

export const hospitalityProfile = {
  id: 'hospitality',
  label: 'Hospitality & Cafe',
  description: 'Questions for cafe, restaurant, bar, and customer-service roles.',
  groups: [
    {
      id: 'hospitality-experience',
      title: 'Customer and service experience',
      questions: [
        {
          id: 'hospitality-customer-service',
          profileId: 'hospitality',
          label: 'Have you worked directly with customers?',
          type: 'boolean',
        },
        {
          id: 'hospitality-pos',
          profileId: 'hospitality',
          label: 'Have you used a POS or cash register?',
          type: 'boolean',
        },
        {
          id: 'hospitality-coffee',
          profileId: 'hospitality',
          label: 'Have you made coffee professionally?',
          type: 'boolean',
        },
      ],
    },
    {
      id: 'hospitality-credentials',
      title: 'Training and licences',
      questions: [
        {
          id: 'hospitality-rsa',
          profileId: 'hospitality',
          label: 'Do you hold a current RSA?',
          type: 'boolean',
        },
        {
          id: 'hospitality-food-safety',
          profileId: 'hospitality',
          label: 'Do you have food handling or food safety training?',
          type: 'boolean',
        },
      ],
    },
    {
      id: 'hospitality-availability',
      title: 'Availability',
      questions: [
        {
          id: 'hospitality-weekends',
          profileId: 'hospitality',
          label: 'Are you available on weekends?',
          type: 'boolean',
        },
        {
          id: 'hospitality-shifts',
          profileId: 'hospitality',
          label: 'What types of shifts can you work?',
          type: 'multi-select',
          options: [
            { value: 'morning', label: 'Morning' },
            { value: 'afternoon', label: 'Afternoon' },
            { value: 'evening', label: 'Evening' },
            { value: 'overnight', label: 'Overnight' },
            { value: 'flexible', label: 'Flexible' },
          ],
        },
      ],
    },
  ],
} satisfies OccupationProfile<'hospitality'>;

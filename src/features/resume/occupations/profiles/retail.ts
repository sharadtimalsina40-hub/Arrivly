import type { OccupationProfile } from '../types';

export const retailProfile = {
  id: 'retail',
  label: 'Retail',
  description: 'Questions for shops, supermarkets, and customer-facing retail roles.',
  groups: [
    {
      id: 'retail-customer-operations',
      title: 'Customer and store operations',
      questions: [
        {
          id: 'retail-customer-service',
          profileId: 'retail',
          label: 'Do you have customer service experience?',
          type: 'boolean',
        },
        {
          id: 'retail-pos',
          profileId: 'retail',
          label: 'Have you used a POS or cash register?',
          type: 'boolean',
        },
        {
          id: 'retail-stock-replenishment',
          profileId: 'retail',
          label: 'Do you have stock replenishment experience?',
          type: 'boolean',
        },
        {
          id: 'retail-stocktake',
          profileId: 'retail',
          label: 'Have you completed inventory counts or stocktakes?',
          type: 'boolean',
        },
        {
          id: 'retail-opening-closing',
          profileId: 'retail',
          label: 'Have you performed opening or closing duties?',
          type: 'boolean',
        },
      ],
    },
    {
      id: 'retail-availability',
      title: 'Availability',
      questions: [
        {
          id: 'retail-weekends',
          profileId: 'retail',
          label: 'Are you available on weekends?',
          type: 'boolean',
        },
      ],
    },
  ],
} satisfies OccupationProfile<'retail'>;

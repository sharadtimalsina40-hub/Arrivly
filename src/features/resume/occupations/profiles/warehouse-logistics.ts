import type { OccupationProfile } from '../types';

export const warehouseLogisticsProfile = {
  id: 'warehouse-logistics',
  label: 'Warehouse & Logistics',
  description: 'Questions for warehousing, distribution, and logistics roles.',
  groups: [
    {
      id: 'warehouse-operations',
      title: 'Warehouse operations',
      questions: [
        {
          id: 'warehouse-pick-packing',
          profileId: 'warehouse-logistics',
          label: 'Do you have pick packing experience?',
          type: 'boolean',
        },
        {
          id: 'warehouse-rf-scanner',
          profileId: 'warehouse-logistics',
          label: 'Have you used an RF scanner?',
          type: 'boolean',
        },
        {
          id: 'warehouse-inventory',
          profileId: 'warehouse-logistics',
          label: 'Do you have inventory management experience?',
          type: 'boolean',
        },
        {
          id: 'warehouse-manual-handling',
          profileId: 'warehouse-logistics',
          label: 'Do you have manual handling experience?',
          type: 'boolean',
        },
      ],
    },
    {
      id: 'warehouse-licences-availability',
      title: 'Licences and availability',
      questions: [
        {
          id: 'warehouse-forklift',
          profileId: 'warehouse-logistics',
          label: 'Do you hold a current forklift licence?',
          type: 'boolean',
        },
        {
          id: 'warehouse-shifts',
          profileId: 'warehouse-logistics',
          label: 'What shifts are you available to work?',
          type: 'multi-select',
          options: [
            { value: 'day', label: 'Day shift' },
            { value: 'afternoon', label: 'Afternoon shift' },
            { value: 'night', label: 'Night shift' },
            { value: 'weekends', label: 'Weekends' },
            { value: 'rotating', label: 'Rotating roster' },
            { value: 'flexible', label: 'Flexible' },
          ],
        },
      ],
    },
  ],
} satisfies OccupationProfile<'warehouse-logistics'>;

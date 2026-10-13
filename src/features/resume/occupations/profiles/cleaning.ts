import type { OccupationProfile } from '../types';

export const cleaningProfile = {
  id: 'cleaning',
  label: 'Cleaning',
  description: 'Questions for commercial, residential, and housekeeping roles.',
  groups: [
    {
      id: 'cleaning-experience',
      title: 'Cleaning experience',
      questions: [
        {
          id: 'cleaning-commercial',
          profileId: 'cleaning',
          label: 'Do you have commercial cleaning experience?',
          type: 'boolean',
        },
        {
          id: 'cleaning-residential',
          profileId: 'cleaning',
          label: 'Do you have residential cleaning experience?',
          type: 'boolean',
        },
        {
          id: 'cleaning-chemicals',
          profileId: 'cleaning',
          label: 'Have you been trained to use cleaning chemicals safely?',
          type: 'boolean',
        },
        {
          id: 'cleaning-equipment',
          profileId: 'cleaning',
          label: 'What cleaning equipment have you used?',
          type: 'text',
          placeholder: 'List only equipment you have personally used.',
        },
      ],
    },
    {
      id: 'cleaning-requirements',
      title: 'Requirements and availability',
      questions: [
        {
          id: 'cleaning-driver-licence',
          profileId: 'cleaning',
          label: 'Do you hold a current driver licence?',
          type: 'boolean',
        },
        {
          id: 'cleaning-availability',
          profileId: 'cleaning',
          label: 'When are you available to work?',
          type: 'multi-select',
          options: [
            { value: 'weekdays', label: 'Weekdays' },
            { value: 'weekends', label: 'Weekends' },
            { value: 'early-mornings', label: 'Early mornings' },
            { value: 'evenings', label: 'Evenings' },
            { value: 'overnight', label: 'Overnight' },
            { value: 'flexible', label: 'Flexible' },
          ],
        },
      ],
    },
  ],
} satisfies OccupationProfile<'cleaning'>;

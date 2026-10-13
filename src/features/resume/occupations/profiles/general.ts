import type { OccupationProfile } from '../types';

export const generalProfile = {
  id: 'general',
  label: 'General / Other',
  description:
    'A short set of questions for roles that do not clearly match another category.',
  groups: [
    {
      id: 'general-relevant-background',
      title: 'Relevant background',
      questions: [
        {
          id: 'general-related-work',
          profileId: 'general',
          label: 'What kind of work have you done that relates to this role?',
          type: 'text',
          multiline: true,
          placeholder: 'Describe only work, study, volunteering, or projects you have actually done.',
        },
        {
          id: 'general-tools',
          profileId: 'general',
          label: 'What tools or systems have you used?',
          type: 'text',
          placeholder: 'List tools or systems you have personally used.',
        },
        {
          id: 'general-responsibilities',
          profileId: 'general',
          label: 'What responsibilities are you comfortable with?',
          type: 'text',
          multiline: true,
        },
      ],
    },
    {
      id: 'general-requirements',
      title: 'Requirements and availability',
      questions: [
        {
          id: 'general-licences',
          profileId: 'general',
          label: 'Are any licences or certifications relevant to this role?',
          type: 'text',
          helpText: 'Enter only licences or certifications you actually hold.',
        },
        {
          id: 'general-availability',
          profileId: 'general',
          label: 'When are you available to work?',
          type: 'multi-select',
          options: [
            { value: 'weekdays', label: 'Weekdays' },
            { value: 'weekends', label: 'Weekends' },
            { value: 'mornings', label: 'Mornings' },
            { value: 'afternoons', label: 'Afternoons' },
            { value: 'evenings', label: 'Evenings' },
            { value: 'overnight', label: 'Overnight' },
            { value: 'flexible', label: 'Flexible' },
          ],
        },
      ],
    },
  ],
} satisfies OccupationProfile<'general'>;

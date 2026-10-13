import type { OccupationProfile } from '../types';

export const engineeringProfile = {
  id: 'engineering',
  label: 'Engineering',
  description: 'Questions for engineering design, site, and project roles.',
  groups: [
    {
      id: 'engineering-discipline-tools',
      title: 'Discipline and tools',
      questions: [
        {
          id: 'engineering-discipline',
          profileId: 'engineering',
          label: 'What is your engineering discipline?',
          type: 'single-select',
          options: [
            { value: 'civil', label: 'Civil' },
            { value: 'mechanical', label: 'Mechanical' },
            { value: 'electrical', label: 'Electrical' },
            { value: 'structural', label: 'Structural' },
            { value: 'chemical', label: 'Chemical' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'engineering-tools',
          profileId: 'engineering',
          label: 'What CAD or engineering software have you used?',
          type: 'text',
        },
      ],
    },
    {
      id: 'engineering-experience-credentials',
      title: 'Experience and credentials',
      questions: [
        {
          id: 'engineering-site-experience',
          profileId: 'engineering',
          label: 'Do you have engineering site experience?',
          type: 'boolean',
        },
        {
          id: 'engineering-projects',
          profileId: 'engineering',
          label: 'Which engineering projects are most relevant?',
          type: 'text',
          multiline: true,
          helpText: 'Describe only projects you actually completed or contributed to.',
        },
        {
          id: 'engineering-accreditation',
          profileId: 'engineering',
          label: 'What professional accreditation do you hold?',
          type: 'text',
          helpText: 'Leave blank if you do not hold an accreditation.',
        },
        {
          id: 'engineering-safety-tickets',
          profileId: 'engineering',
          label: 'What safety tickets or licences do you hold?',
          type: 'text',
        },
      ],
    },
  ],
} satisfies OccupationProfile<'engineering'>;

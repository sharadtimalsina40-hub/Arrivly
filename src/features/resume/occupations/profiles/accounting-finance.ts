import type { OccupationProfile } from '../types';

export const accountingFinanceProfile = {
  id: 'accounting-finance',
  label: 'Accounting & Finance',
  description: 'Questions for accounting, bookkeeping, payroll, and finance roles.',
  groups: [
    {
      id: 'accounting-tools',
      title: 'Software and tools',
      questions: [
        {
          id: 'accounting-software',
          profileId: 'accounting-finance',
          label: 'What accounting software have you used?',
          type: 'text',
          placeholder: 'For example, Xero or MYOB—only if you have used them.',
        },
        {
          id: 'accounting-excel',
          profileId: 'accounting-finance',
          label: 'How would you describe your Excel experience?',
          type: 'single-select',
          options: [
            { value: 'none', label: 'No experience yet' },
            { value: 'basic', label: 'Basic' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
          ],
        },
      ],
    },
    {
      id: 'accounting-experience',
      title: 'Accounting experience',
      questions: [
        {
          id: 'accounting-payroll',
          profileId: 'accounting-finance',
          label: 'Do you have payroll experience?',
          type: 'boolean',
        },
        {
          id: 'accounting-ap-ar',
          profileId: 'accounting-finance',
          label: 'Which functions have you worked with?',
          type: 'multi-select',
          options: [
            { value: 'accounts-payable', label: 'Accounts payable' },
            { value: 'accounts-receivable', label: 'Accounts receivable' },
          ],
        },
        {
          id: 'accounting-australian-standards',
          profileId: 'accounting-finance',
          label: 'Do you have experience with Australian accounting standards?',
          type: 'boolean',
        },
        {
          id: 'accounting-credentials',
          profileId: 'accounting-finance',
          label: 'What professional registrations or certifications do you hold?',
          type: 'text',
          helpText: 'Enter only current or accurately described credentials.',
        },
      ],
    },
  ],
} satisfies OccupationProfile<'accounting-finance'>;

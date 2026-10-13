import type { OccupationProfile } from '../types';

export const marketingProfile = {
  id: 'marketing',
  label: 'Marketing',
  description: 'Questions for digital, content, social, and campaign marketing roles.',
  groups: [
    {
      id: 'marketing-channels',
      title: 'Channels and capabilities',
      questions: [
        {
          id: 'marketing-seo',
          profileId: 'marketing',
          label: 'Do you have SEO experience?',
          type: 'boolean',
        },
        {
          id: 'marketing-paid-advertising',
          profileId: 'marketing',
          label: 'Which paid advertising platforms have you used?',
          type: 'multi-select',
          options: [
            { value: 'google-ads', label: 'Google Ads' },
            { value: 'meta-ads', label: 'Meta Ads' },
            { value: 'linkedin-ads', label: 'LinkedIn Ads' },
            { value: 'tiktok-ads', label: 'TikTok Ads' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'marketing-analytics',
          profileId: 'marketing',
          label: 'What analytics tools have you used?',
          type: 'text',
        },
        {
          id: 'marketing-social-media',
          profileId: 'marketing',
          label: 'Which social media channels have you managed?',
          type: 'multi-select',
          options: [
            { value: 'instagram', label: 'Instagram' },
            { value: 'facebook', label: 'Facebook' },
            { value: 'linkedin', label: 'LinkedIn' },
            { value: 'tiktok', label: 'TikTok' },
            { value: 'youtube', label: 'YouTube' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'marketing-content',
          profileId: 'marketing',
          label: 'What types of content have you created?',
          type: 'multi-select',
          options: [
            { value: 'copywriting', label: 'Copywriting' },
            { value: 'blog-content', label: 'Blog content' },
            { value: 'email-content', label: 'Email content' },
            { value: 'video', label: 'Video' },
            { value: 'design', label: 'Design assets' },
            { value: 'other', label: 'Other' },
          ],
        },
      ],
    },
    {
      id: 'marketing-platforms-results',
      title: 'Platforms and results',
      questions: [
        {
          id: 'marketing-crm-email',
          profileId: 'marketing',
          label: 'What CRM or email marketing platforms have you used?',
          type: 'text',
        },
        {
          id: 'marketing-campaign-results',
          profileId: 'marketing',
          label: 'What campaign results can you accurately describe?',
          type: 'text',
          multiline: true,
          helpText: 'Leave blank unless the result is true and supportable.',
        },
      ],
    },
  ],
} satisfies OccupationProfile<'marketing'>;

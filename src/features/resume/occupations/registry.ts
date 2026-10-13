import type { OccupationProfileId } from '../model/types';
import { accountingFinanceProfile } from './profiles/accounting-finance';
import { cleaningProfile } from './profiles/cleaning';
import { engineeringProfile } from './profiles/engineering';
import { generalProfile } from './profiles/general';
import { hospitalityProfile } from './profiles/hospitality';
import { marketingProfile } from './profiles/marketing';
import { retailProfile } from './profiles/retail';
import { softwareProfile } from './profiles/software';
import { warehouseLogisticsProfile } from './profiles/warehouse-logistics';
import type { OccupationProfile } from './types';

export const OCCUPATION_PROFILE_IDS = [
  'general',
  'hospitality',
  'retail',
  'cleaning',
  'warehouse-logistics',
  'software',
  'accounting-finance',
  'engineering',
  'marketing',
] as const satisfies readonly OccupationProfileId[];

export const occupationProfiles = {
  general: generalProfile,
  hospitality: hospitalityProfile,
  retail: retailProfile,
  cleaning: cleaningProfile,
  'warehouse-logistics': warehouseLogisticsProfile,
  software: softwareProfile,
  'accounting-finance': accountingFinanceProfile,
  engineering: engineeringProfile,
  marketing: marketingProfile,
} as const satisfies Record<OccupationProfileId, OccupationProfile>;

export const occupationProfileOptions = OCCUPATION_PROFILE_IDS.map(
  (profileId) => ({
    value: profileId,
    label: occupationProfiles[profileId].label,
  }),
);

interface OccupationClassificationRule {
  readonly profileId: Exclude<OccupationProfileId, 'general'>;
  readonly phrases: readonly string[];
}

const CLASSIFICATION_RULES: readonly OccupationClassificationRule[] = [
  {
    profileId: 'hospitality',
    phrases: [
      'barista',
      'cafe all rounder',
      'waiter',
      'waitress',
      'waitstaff',
      'food and beverage attendant',
      'restaurant crew',
    ],
  },
  {
    profileId: 'retail',
    phrases: [
      'retail assistant',
      'retail team member',
      'store team member',
      'grocery assistant',
      'supermarket assistant',
      'sales assistant',
      'shop assistant',
      'checkout operator',
    ],
  },
  {
    profileId: 'cleaning',
    phrases: [
      'cleaner',
      'commercial cleaner',
      'residential cleaner',
      'housekeeper',
      'housekeeping attendant',
      'cleaning attendant',
    ],
  },
  {
    profileId: 'warehouse-logistics',
    phrases: [
      'warehouse worker',
      'warehouse assistant',
      'pick packer',
      'picker packer',
      'storeperson',
      'forklift operator',
      'warehouse operator',
      'logistics assistant',
    ],
  },
  {
    profileId: 'software',
    phrases: [
      'software engineer',
      'software developer',
      'backend developer',
      'back end developer',
      'frontend developer',
      'front end developer',
      'full stack developer',
      'web developer',
      'mobile developer',
      'devops engineer',
    ],
  },
  {
    profileId: 'accounting-finance',
    phrases: [
      'accountant',
      'bookkeeper',
      'finance analyst',
      'financial analyst',
      'accounts payable',
      'accounts receivable',
      'payroll officer',
      'auditor',
    ],
  },
  {
    profileId: 'engineering',
    phrases: [
      'civil engineer',
      'mechanical engineer',
      'electrical engineer',
      'structural engineer',
      'chemical engineer',
      'process engineer',
      'project engineer',
      'engineering graduate',
    ],
  },
  {
    profileId: 'marketing',
    phrases: [
      'marketing coordinator',
      'marketing specialist',
      'digital marketer',
      'digital marketing',
      'seo specialist',
      'content marketer',
      'social media manager',
      'growth marketer',
    ],
  },
];

export type OccupationClassificationStatus =
  | 'matched'
  | 'fallback'
  | 'ambiguous';

export interface OccupationClassification {
  readonly profileId: OccupationProfileId;
  readonly status: OccupationClassificationStatus;
  readonly matchedPhrases: readonly string[];
}

export function getOccupationProfile(
  profileId: OccupationProfileId,
): OccupationProfile {
  return occupationProfiles[profileId];
}

function normaliseJobTitle(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-AU')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function containsPhrase(title: string, phrase: string): boolean {
  const paddedTitle = ` ${title} `;
  const normalisedPhrase = normaliseJobTitle(phrase);
  return paddedTitle.includes(` ${normalisedPhrase} `);
}

export function classifyOccupationFromJobTitle(
  jobTitle: string,
): OccupationClassification {
  const normalisedTitle = normaliseJobTitle(jobTitle);

  if (!normalisedTitle) {
    return {
      profileId: 'general',
      status: 'fallback',
      matchedPhrases: [],
    };
  }

  const matchingRules = CLASSIFICATION_RULES.map((rule) => ({
    profileId: rule.profileId,
    matchedPhrases: rule.phrases.filter((phrase) =>
      containsPhrase(normalisedTitle, phrase),
    ),
  })).filter((match) => match.matchedPhrases.length > 0);

  if (matchingRules.length === 1) {
    return {
      profileId: matchingRules[0].profileId,
      status: 'matched',
      matchedPhrases: matchingRules[0].matchedPhrases,
    };
  }

  return {
    profileId: 'general',
    status: matchingRules.length > 1 ? 'ambiguous' : 'fallback',
    matchedPhrases: matchingRules.flatMap((match) => match.matchedPhrases),
  };
}

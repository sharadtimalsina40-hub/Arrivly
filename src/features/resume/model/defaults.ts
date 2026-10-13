import type {
  AdaptiveAnswer,
  AdaptiveAnswerValue,
  EducationEntry,
  ExperienceEntry,
  ExperienceKind,
  IsoDateTime,
  LicenceEntry,
  OccupationProfileId,
  ResumeDraftV1,
  SkillEntry,
  UserFact,
} from './types';

export interface CreateInitialResumeDraftOptions {
  id?: string;
  timestamp?: IsoDateTime;
}

function createDraftId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `resume-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEntryId(prefix: string): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyExperienceEntry(
  kind: ExperienceKind = 'employment',
): ExperienceEntry {
  return {
    id: createEntryId('experience'),
    kind,
    roleTitle: '',
    isCurrent: false,
    highlights: [],
  };
}

export function createEmptyExperienceHighlight(): UserFact {
  return {
    id: createEntryId('fact'),
    category: 'responsibility',
    text: '',
    source: 'user',
  };
}

export function createEmptyEducationEntry(): EducationEntry {
  return {
    id: createEntryId('education'),
    qualification: '',
    institution: '',
    status: 'completed',
    highlights: [],
  };
}

export function createEmptySkillEntry(): SkillEntry {
  return {
    id: createEntryId('skill'),
    name: '',
    category: 'other',
    source: 'user',
    evidenceFactIds: [],
  };
}

export function createEmptyLicenceEntry(): LicenceEntry {
  return {
    id: createEntryId('licence'),
    name: '',
    status: 'current',
  };
}

export function createAdaptiveAnswer(
  questionId: string,
  occupationProfileId: OccupationProfileId,
  answer: AdaptiveAnswerValue,
): AdaptiveAnswer {
  return {
    id: createEntryId('adaptive-answer'),
    questionId,
    occupationProfileId,
    answer,
    confirmed: true,
  };
}

export function createInitialResumeDraft(
  options: CreateInitialResumeDraftOptions = {},
): ResumeDraftV1 {
  const timestamp = options.timestamp ?? new Date().toISOString();

  return {
    schemaVersion: 1,
    id: options.id ?? createDraftId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    targetJob: {
      desiredTitle: '',
      jobAdvertisement: {
        status: 'not-provided',
      },
      occupation: {
        profileId: 'general',
        selectedBy: 'rule',
        confirmed: false,
      },
    },
    personalDetails: {
      fullName: '',
      phone: '',
      email: '',
      location: {
        city: '',
      },
      links: {},
    },
    experienceInput: {
      mode: 'structured',
      naturalDescription: '',
      hasNoFormalExperience: false,
    },
    experience: [],
    education: [],
    licences: [],
    skills: [],
    availability: {
      employmentTypes: [],
      days: [],
      shifts: [],
    },
    adaptiveAnswers: [],
    preferences: {
      templateId: 'australian-standard',
      locale: 'en-AU',
    },
  };
}

// Canonical résumé domain types.
// Keep editor-only state and generated résumé copy outside this model.

export type TemplateId =
  | 'australian-standard'
  | 'professional'
  | 'modern';

export type OccupationProfileId =
  | 'general'
  | 'hospitality'
  | 'retail'
  | 'cleaning'
  | 'warehouse-logistics'
  | 'software'
  | 'accounting-finance'
  | 'engineering'
  | 'marketing';

export type ExperienceKind =
  | 'employment'
  | 'self-employment'
  | 'volunteer'
  | 'internship'
  | 'placement'
  | 'project'
  | 'education-project';

export type ExperienceInputMode = 'structured' | 'natural';

export type AustralianStateOrTerritory =
  | 'ACT'
  | 'NSW'
  | 'NT'
  | 'QLD'
  | 'SA'
  | 'TAS'
  | 'VIC'
  | 'WA';

export type EducationStatus = 'completed' | 'current' | 'incomplete';

export type LicenceStatus = 'current' | 'expired' | 'in-progress';

export type SkillCategory =
  | 'industry'
  | 'technical'
  | 'software'
  | 'language'
  | 'transferable'
  | 'other';

export type EmploymentType =
  | 'casual'
  | 'part-time'
  | 'full-time'
  | 'contract';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type ShiftPreference =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'overnight'
  | 'flexible';

export type UserFactCategory =
  | 'responsibility'
  | 'achievement'
  | 'project'
  | 'skill-evidence'
  | 'other';

export type Month =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12';

export type YearMonth = `${number}-${Month}`;
export type IsoDate = `${number}-${Month}-${number}`;
export type IsoDateTime = string;

export type JobAdvertisement =
  | {
      status: 'provided';
      text: string;
    }
  | {
      status: 'not-provided';
    };

export type AdaptiveAnswerValue =
  | {
      kind: 'boolean';
      value: boolean;
    }
  | {
      kind: 'text';
      value: string;
    }
  | {
      kind: 'number';
      value: number;
    }
  | {
      kind: 'single-choice';
      value: string;
    }
  | {
      kind: 'multiple-choice';
      value: string[];
    };

export interface ResumeLocation {
  suburb?: string;
  city: string;
  stateOrTerritory?: AustralianStateOrTerritory;
  postcode?: string;
  country?: string;
}

export interface ProfessionalLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface PersonalDetails {
  fullName: string;
  phone: string;
  email: string;
  location: ResumeLocation;
  links: ProfessionalLinks;
}

export interface OccupationSelection {
  profileId: OccupationProfileId;
  selectedBy: 'rule' | 'user';
  confirmed: boolean;
}

export interface TargetJob {
  desiredTitle: string;
  employer?: string;
  jobAdvertisement: JobAdvertisement;
  occupation: OccupationSelection;
}

export interface ExperienceInput {
  mode: ExperienceInputMode;
  naturalDescription: string;
  hasNoFormalExperience: boolean;
}

export interface UserFact {
  readonly id: string;
  category: UserFactCategory;
  text: string;
  source: 'user';
}

export interface ExperienceEntry {
  readonly id: string;
  kind: ExperienceKind;
  roleTitle: string;
  organisation?: string;
  location?: ResumeLocation;
  startDate?: YearMonth;
  endDate?: YearMonth;
  isCurrent: boolean;
  description?: string;
  highlights: UserFact[];
}

export interface EducationEntry {
  readonly id: string;
  qualification: string;
  fieldOfStudy?: string;
  institution: string;
  location?: ResumeLocation;
  startDate?: YearMonth;
  completionDate?: YearMonth;
  status: EducationStatus;
  highlights: UserFact[];
}

export interface LicenceEntry {
  readonly id: string;
  name: string;
  issuer?: string;
  jurisdiction?: string;
  issuedDate?: YearMonth;
  expiryDate?: YearMonth;
  status: LicenceStatus;
  notes?: string;
}

export interface SkillEntry {
  readonly id: string;
  name: string;
  category: SkillCategory;
  source: 'user';
  evidenceFactIds: string[];
}

export interface Availability {
  availableFrom?: IsoDate;
  employmentTypes: EmploymentType[];
  days: DayOfWeek[];
  shifts: ShiftPreference[];
  notes?: string;
}

export interface AdaptiveAnswer {
  readonly id: string;
  questionId: string;
  occupationProfileId: OccupationProfileId;
  answer: AdaptiveAnswerValue;
  confirmed: boolean;
}

export interface ResumePreferences {
  templateId: TemplateId;
  locale: 'en-AU';
}

export interface ResumeDraftV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  targetJob: TargetJob;
  personalDetails: PersonalDetails;
  experienceInput: ExperienceInput;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  licences: LicenceEntry[];
  skills: SkillEntry[];
  availability: Availability;
  adaptiveAnswers: AdaptiveAnswer[];
  preferences: ResumePreferences;
}

import type {
  EducationStatus,
  ExperienceKind,
  LicenceStatus,
  ResumeDraftV1,
  ResumeLocation,
  SkillCategory,
  YearMonth,
} from './types';

export type ResumeLinkKind = 'linkedin' | 'github' | 'portfolio';

export interface ResumeContactLinkViewModel {
  readonly kind: ResumeLinkKind;
  readonly value: string;
}

export interface ResumeContactViewModel {
  readonly phone?: string;
  readonly email?: string;
  readonly location?: string;
  readonly links?: readonly ResumeContactLinkViewModel[];
}

export interface ResumeCandidateViewModel {
  readonly name?: string;
  readonly contact: ResumeContactViewModel;
}

export interface ResumeHighlightViewModel {
  readonly sourceFactId: string;
  readonly text: string;
}

export interface ResumeExperienceViewModel {
  readonly id: string;
  readonly kind: ExperienceKind;
  readonly roleTitle?: string;
  readonly organisation?: string;
  readonly location?: string;
  readonly dateRange?: string;
  readonly description?: string;
  readonly highlights?: readonly ResumeHighlightViewModel[];
}

export interface ResumeEducationViewModel {
  readonly id: string;
  readonly qualification?: string;
  readonly fieldOfStudy?: string;
  readonly institution?: string;
  readonly location?: string;
  readonly dateRange?: string;
  readonly status: EducationStatus;
  readonly statusLine: string;
  readonly highlights?: readonly ResumeHighlightViewModel[];
}

export interface ResumeSkillViewModel {
  readonly id: string;
  readonly name: string;
  readonly category: SkillCategory;
  readonly source: 'user' | 'tailored';
  readonly evidenceFactIds: readonly string[];
}

export interface ResumeLicenceViewModel {
  readonly id: string;
  readonly name?: string;
  readonly authority?: string;
  readonly status: LicenceStatus;
  readonly statusLine: string;
}

export interface ResumeSectionsViewModel {
  readonly experience?: readonly ResumeExperienceViewModel[];
  readonly education?: readonly ResumeEducationViewModel[];
  readonly skills?: readonly ResumeSkillViewModel[];
  readonly licences?: readonly ResumeLicenceViewModel[];
}

export interface ResumeViewModel {
  readonly candidate: ResumeCandidateViewModel;
  readonly targetJobTitle?: string;
  readonly summary?: string;
  readonly sections: ResumeSectionsViewModel;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function cleanInlineText(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/\s+/g, ' ');
  return cleaned === '' ? undefined : cleaned;
}

function cleanBlockText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned === '' ? undefined : cleaned;
}

function formatLocation(location: ResumeLocation | undefined): string | undefined {
  if (!location) {
    return undefined;
  }

  const suburb = cleanInlineText(location.suburb);
  const city = cleanInlineText(location.city);
  const stateOrTerritory = cleanInlineText(location.stateOrTerritory);
  const postcode = cleanInlineText(location.postcode);
  const country = cleanInlineText(location.country);
  const region = [stateOrTerritory, postcode].filter(isDefined).join(' ');
  const parts = [suburb, city, region || undefined, country].filter(isDefined);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

function formatYearMonth(value: YearMonth | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);

  if (!match) {
    return cleanInlineText(value);
  }

  const monthIndex = Number(match[2]) - 1;
  return `${MONTH_LABELS[monthIndex]} ${match[1]}`;
}

function formatDateRange(
  startDate: YearMonth | undefined,
  endDate: YearMonth | undefined,
  isCurrent: boolean,
): string | undefined {
  const start = formatYearMonth(startDate);
  const end = isCurrent ? 'Present' : formatYearMonth(endDate);

  if (start && end) {
    return `${start} – ${end}`;
  }

  return start ?? end;
}

function formatEducationStatus(
  status: EducationStatus,
  completionDate: YearMonth | undefined,
): string {
  const completion = formatYearMonth(completionDate);

  if (status === 'current') {
    return completion
      ? `Expected completion ${completion}`
      : 'Currently studying';
  }

  if (status === 'incomplete') {
    return completion ? `Incomplete · ${completion}` : 'Incomplete';
  }

  return completion ? `Completed ${completion}` : 'Completed';
}

function formatLicenceStatus(
  status: LicenceStatus,
  expiryDate: YearMonth | undefined,
): string {
  const expiry = formatYearMonth(expiryDate);

  if (status === 'expired') {
    return expiry ? `Expired ${expiry}` : 'Expired';
  }

  if (status === 'in-progress') {
    return expiry ? `In progress · Expires ${expiry}` : 'In progress';
  }

  return expiry ? `Expires ${expiry}` : 'Current';
}

function buildHighlights(
  highlights: ResumeDraftV1['experience'][number]['highlights'],
): ResumeHighlightViewModel[] {
  return highlights
    .map((fact) => {
      const text = cleanBlockText(fact.text);

      if (!text) {
        return undefined;
      }

      return {
        sourceFactId: fact.id,
        text,
      };
    })
    .filter(isDefined);
}

function buildContact(
  draft: ResumeDraftV1,
): ResumeContactViewModel {
  const phone = cleanInlineText(draft.personalDetails.phone);
  const email = cleanInlineText(draft.personalDetails.email);
  const location = formatLocation(draft.personalDetails.location);
  const links = (
    [
      ['linkedin', draft.personalDetails.links.linkedin],
      ['github', draft.personalDetails.links.github],
      ['portfolio', draft.personalDetails.links.portfolio],
    ] as const
  )
    .map(([kind, rawValue]) => {
      const value = cleanInlineText(rawValue);
      return value ? { kind, value } : undefined;
    })
    .filter(isDefined);

  return {
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(location ? { location } : {}),
    ...(links.length > 0 ? { links } : {}),
  };
}

function buildExperienceEntry(
  entry: ResumeDraftV1['experience'][number],
): ResumeExperienceViewModel | undefined {
  const roleTitle = cleanInlineText(entry.roleTitle);
  const organisation = cleanInlineText(entry.organisation);
  const location = formatLocation(entry.location);
  const description = cleanBlockText(entry.description);
  const highlights = buildHighlights(entry.highlights);
  const hasContent = Boolean(
    roleTitle ||
      organisation ||
      location ||
      entry.startDate ||
      entry.endDate ||
      description ||
      highlights.length > 0,
  );

  if (!hasContent) {
    return undefined;
  }

  const dateRange = formatDateRange(
    entry.startDate,
    entry.endDate,
    entry.isCurrent,
  );

  return {
    id: entry.id,
    kind: entry.kind,
    ...(roleTitle ? { roleTitle } : {}),
    ...(organisation ? { organisation } : {}),
    ...(location ? { location } : {}),
    ...(dateRange ? { dateRange } : {}),
    ...(description ? { description } : {}),
    ...(highlights.length > 0 ? { highlights } : {}),
  };
}

function buildEducationEntry(
  entry: ResumeDraftV1['education'][number],
): ResumeEducationViewModel | undefined {
  const qualification = cleanInlineText(entry.qualification);
  const fieldOfStudy = cleanInlineText(entry.fieldOfStudy);
  const institution = cleanInlineText(entry.institution);
  const location = formatLocation(entry.location);
  const highlights = buildHighlights(entry.highlights);
  const hasContent = Boolean(
    qualification ||
      fieldOfStudy ||
      institution ||
      location ||
      entry.startDate ||
      entry.completionDate ||
      highlights.length > 0,
  );

  if (!hasContent) {
    return undefined;
  }

  const dateRange = formatDateRange(
    entry.startDate,
    entry.completionDate,
    entry.status === 'current' && entry.completionDate === undefined,
  );

  return {
    id: entry.id,
    ...(qualification ? { qualification } : {}),
    ...(fieldOfStudy ? { fieldOfStudy } : {}),
    ...(institution ? { institution } : {}),
    ...(location ? { location } : {}),
    ...(dateRange ? { dateRange } : {}),
    status: entry.status,
    statusLine: formatEducationStatus(entry.status, entry.completionDate),
    ...(highlights.length > 0 ? { highlights } : {}),
  };
}

function buildSkillEntry(
  entry: ResumeDraftV1['skills'][number],
): ResumeSkillViewModel | undefined {
  const name = cleanInlineText(entry.name);

  if (!name) {
    return undefined;
  }

  return {
    id: entry.id,
    name,
    category: entry.category,
    source: entry.source,
    evidenceFactIds: [...entry.evidenceFactIds],
  };
}

function buildLicenceEntry(
  entry: ResumeDraftV1['licences'][number],
): ResumeLicenceViewModel | undefined {
  const name = cleanInlineText(entry.name);
  const issuer = cleanInlineText(entry.issuer);
  const jurisdiction = cleanInlineText(entry.jurisdiction);
  const hasContent = Boolean(
    name ||
      issuer ||
      jurisdiction ||
      entry.issuedDate ||
      entry.expiryDate ||
      cleanBlockText(entry.notes),
  );

  if (!hasContent) {
    return undefined;
  }

  const authority = [issuer, jurisdiction].filter(isDefined).join(' · ');

  return {
    id: entry.id,
    ...(name ? { name } : {}),
    ...(authority ? { authority } : {}),
    status: entry.status,
    statusLine: formatLicenceStatus(entry.status, entry.expiryDate),
  };
}

export function buildResumeViewModel(
  draft: ResumeDraftV1,
): ResumeViewModel {
  // Job-ad text and raw natural-language answers are tailoring inputs, not
  // candidate claims ready for a resume. They must be explicitly processed
  // and confirmed in a later phase before they can enter this view model.
  const name = cleanInlineText(draft.personalDetails.fullName);
  const targetJobTitle = cleanInlineText(draft.targetJob.desiredTitle);
  const experience = draft.experience
    .map(buildExperienceEntry)
    .filter(isDefined);
  const education = draft.education
    .map(buildEducationEntry)
    .filter(isDefined);
  const skills = draft.skills.map(buildSkillEntry).filter(isDefined);
  const licences = draft.licences.map(buildLicenceEntry).filter(isDefined);

  return {
    candidate: {
      ...(name ? { name } : {}),
      contact: buildContact(draft),
    },
    ...(targetJobTitle ? { targetJobTitle } : {}),
    sections: {
      ...(experience.length > 0 ? { experience } : {}),
      ...(education.length > 0 ? { education } : {}),
      ...(skills.length > 0 ? { skills } : {}),
      ...(licences.length > 0 ? { licences } : {}),
    },
  };
}

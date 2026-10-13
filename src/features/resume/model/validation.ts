import type {
  EducationStatus,
  ExperienceKind,
  ResumeDraftV1,
} from './types';

export type ResumeValidationErrors = Readonly<Record<string, string>>;

export interface ResumeValidationResult {
  valid: boolean;
  errors: ResumeValidationErrors;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ORGANISATION_REQUIRED_EXPERIENCE_KINDS: ReadonlySet<ExperienceKind> =
  new Set(['employment', 'volunteer', 'internship', 'placement']);

export function isOrganisationRequiredForExperience(
  kind: ExperienceKind,
): boolean {
  return ORGANISATION_REQUIRED_EXPERIENCE_KINDS.has(kind);
}

export function isEducationCompletionRequired(
  status: EducationStatus,
): boolean {
  return status === 'completed';
}

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function normaliseComparableText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-AU');
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

export function isAustralianFriendlyPhone(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  if (!/^\+?[\d\s().-]+$/.test(trimmed)) {
    return false;
  }

  const digitCount = trimmed.replace(/\D/g, '').length;
  return digitCount >= 8 && digitCount <= 15;
}

export function isValidProfessionalUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function addError(
  errors: Record<string, string>,
  path: string,
  message: string,
) {
  if (!(path in errors)) {
    errors[path] = message;
  }
}

function parseYearMonth(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = YEAR_MONTH_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  return year * 12 + month - 1;
}

function validateOptionalYearMonth(
  value: unknown,
  path: string,
  errors: Record<string, string>,
): number | null {
  if (value === undefined || value === '') {
    return null;
  }

  const parsed = parseYearMonth(value);

  if (parsed === null) {
    addError(errors, path, 'Use a valid month in YYYY-MM format');
  }

  return parsed;
}

function validateDateRange(
  startDate: unknown,
  endDate: unknown,
  startPath: string,
  endPath: string,
  errors: Record<string, string>,
) {
  const start = validateOptionalYearMonth(startDate, startPath, errors);
  const end = validateOptionalYearMonth(endDate, endPath, errors);

  if (start !== null && end !== null && end < start) {
    addError(errors, endPath, 'End date cannot be before start date');
  }
}

export function validateResumeDraft(
  draft: ResumeDraftV1,
): ResumeValidationResult {
  const errors: Record<string, string> = {};

  if (isBlank(draft.personalDetails.fullName)) {
    addError(
      errors,
      'personalDetails.fullName',
      'Enter your full name',
    );
  }

  if (isBlank(draft.targetJob.desiredTitle)) {
    addError(
      errors,
      'targetJob.desiredTitle',
      'Enter the target job title',
    );
  }

  if (!draft.targetJob.occupation.confirmed) {
    addError(
      errors,
      'targetJob.occupation.confirmed',
      'Confirm the occupation category or choose a different one',
    );
  }

  if (isBlank(draft.personalDetails.email)) {
    addError(
      errors,
      'personalDetails.email',
      'Enter your email address',
    );
  } else if (!isValidEmail(draft.personalDetails.email)) {
    addError(
      errors,
      'personalDetails.email',
      'Enter a valid email address',
    );
  }

  if (isBlank(draft.personalDetails.phone)) {
    addError(
      errors,
      'personalDetails.phone',
      'Enter your phone number',
    );
  } else if (!isAustralianFriendlyPhone(draft.personalDetails.phone)) {
    addError(
      errors,
      'personalDetails.phone',
      'Enter a valid phone number, such as 0412 345 678 or +61 412 345 678',
    );
  }

  if (isBlank(draft.personalDetails.location.city)) {
    addError(
      errors,
      'personalDetails.location.city',
      'Enter your city',
    );
  }

  const professionalLinks = [
    {
      path: 'personalDetails.links.linkedin',
      label: 'LinkedIn',
      value: draft.personalDetails.links.linkedin,
    },
    {
      path: 'personalDetails.links.github',
      label: 'GitHub',
      value: draft.personalDetails.links.github,
    },
    {
      path: 'personalDetails.links.portfolio',
      label: 'portfolio',
      value: draft.personalDetails.links.portfolio,
    },
  ] as const;

  for (const link of professionalLinks) {
    if (!isBlank(link.value) && !isValidProfessionalUrl(link.value)) {
      addError(
        errors,
        link.path,
        `Enter a valid ${link.label} URL beginning with http:// or https://`,
      );
    }
  }

  if (
    draft.targetJob.jobAdvertisement.status === 'provided' &&
    isBlank(draft.targetJob.jobAdvertisement.text)
  ) {
    addError(
      errors,
      'targetJob.jobAdvertisement.text',
      'Paste the job advertisement or select “I don’t have the job ad”',
    );
  }

  if (
    draft.experience.length === 0 &&
    !draft.experienceInput.hasNoFormalExperience
  ) {
    addError(
      errors,
      'experienceInput.hasNoFormalExperience',
      'Add an experience or confirm that you do not have formal work experience yet',
    );
  }

  for (const entry of draft.experience) {
    const path = `experience.${entry.id}`;

    if (isBlank(entry.roleTitle)) {
      addError(errors, `${path}.roleTitle`, 'Enter a role or title');
    }

    if (
      isOrganisationRequiredForExperience(entry.kind) &&
      isBlank(entry.organisation)
    ) {
      addError(
        errors,
        `${path}.organisation`,
        'Enter the organisation name',
      );
    }

    if (entry.isCurrent && entry.endDate !== undefined) {
      addError(
        errors,
        `${path}.endDate`,
        'A current role cannot also have an end date',
      );
    }

    validateDateRange(
      entry.startDate,
      entry.endDate,
      `${path}.startDate`,
      `${path}.endDate`,
      errors,
    );
  }

  for (const entry of draft.education) {
    const path = `education.${entry.id}`;

    if (isBlank(entry.qualification)) {
      addError(errors, `${path}.qualification`, 'Enter the qualification');
    }

    if (isBlank(entry.institution)) {
      addError(errors, `${path}.institution`, 'Enter the institution');
    }

    if (
      isEducationCompletionRequired(entry.status) &&
      entry.completionDate === undefined
    ) {
      addError(
        errors,
        `${path}.completionDate`,
        'Enter the completion month for a completed qualification',
      );
    }

    validateDateRange(
      entry.startDate,
      entry.completionDate,
      `${path}.startDate`,
      `${path}.completionDate`,
      errors,
    );
  }

  const firstSkillIdByName = new Map<string, string>();

  for (const entry of draft.skills) {
    const path = `skills.${entry.id}`;

    if (isBlank(entry.name)) {
      addError(errors, `${path}.name`, 'Enter the skill name');
      continue;
    }

    const comparableName = normaliseComparableText(entry.name);
    const existingEntryId = firstSkillIdByName.get(comparableName);

    if (existingEntryId) {
      addError(errors, `${path}.name`, 'This skill is already listed');
    } else {
      firstSkillIdByName.set(comparableName, entry.id);
    }
  }

  for (const entry of draft.licences) {
    const path = `licences.${entry.id}`;

    if (isBlank(entry.name)) {
      addError(
        errors,
        `${path}.name`,
        'Enter the licence or certification name',
      );
    }

    validateDateRange(
      entry.issuedDate,
      entry.expiryDate,
      `${path}.issuedDate`,
      `${path}.expiryDate`,
      errors,
    );
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

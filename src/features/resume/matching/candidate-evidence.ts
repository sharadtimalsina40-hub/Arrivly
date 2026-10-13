import type {
  AdaptiveAnswer,
  DayOfWeek,
  EmploymentType,
  ExperienceEntry,
  ShiftPreference,
} from '../model/types';
import {
  OCCUPATION_PROFILE_IDS,
  occupationProfiles,
} from '../occupations/registry';
import type { OccupationQuestionDefinition } from '../occupations/types';
import { buildNormalizedTerms } from './normalize';
import type {
  CandidateEvidence,
  CandidateEvidenceClass,
  CandidateEvidenceIndex,
  CandidateEvidenceInput,
  CandidateEvidencePolarity,
  CandidateEvidenceSource,
  CandidateEvidenceStrength,
} from './types';

interface EvidenceInput {
  readonly id: string;
  readonly source: CandidateEvidenceSource;
  readonly sourceId: string;
  readonly parentSourceId?: string;
  readonly fieldPath: string;
  readonly sourceLabel: string;
  readonly contextLabel?: string;
  readonly text: string;
  readonly termText?: string;
  readonly evidenceClass: CandidateEvidenceClass;
  readonly polarity?: CandidateEvidencePolarity;
  readonly strength?: CandidateEvidenceStrength;
  readonly metadata?: CandidateEvidence['metadata'];
}

interface AdaptiveEvidenceRule {
  readonly concept?: string;
  readonly evidenceClass: CandidateEvidenceClass;
}

const ADAPTIVE_EVIDENCE_RULES: Readonly<
  Record<string, AdaptiveEvidenceRule | undefined>
> = {
  'hospitality-customer-service': {
    concept: 'customer service',
    evidenceClass: 'skill',
  },
  'hospitality-pos': { concept: 'POS', evidenceClass: 'skill' },
  'hospitality-coffee': {
    concept: 'professional coffee preparation',
    evidenceClass: 'skill',
  },
  'hospitality-rsa': { concept: 'RSA', evidenceClass: 'certification' },
  'hospitality-food-safety': {
    concept: 'food safety training',
    evidenceClass: 'certification',
  },
  'hospitality-weekends': {
    concept: 'weekend availability',
    evidenceClass: 'availability',
  },
  'hospitality-shifts': { evidenceClass: 'availability' },
  'retail-customer-service': {
    concept: 'customer service',
    evidenceClass: 'skill',
  },
  'retail-pos': { concept: 'POS', evidenceClass: 'skill' },
  'retail-stock-replenishment': {
    concept: 'stock replenishment',
    evidenceClass: 'skill',
  },
  'retail-stocktake': { concept: 'stocktake', evidenceClass: 'skill' },
  'retail-opening-closing': {
    concept: 'opening and closing duties',
    evidenceClass: 'skill',
  },
  'retail-weekends': {
    concept: 'weekend availability',
    evidenceClass: 'availability',
  },
  'cleaning-commercial': {
    concept: 'commercial cleaning experience',
    evidenceClass: 'experience',
  },
  'cleaning-residential': {
    concept: 'residential cleaning experience',
    evidenceClass: 'experience',
  },
  'cleaning-chemicals': {
    concept: 'safe cleaning chemical training',
    evidenceClass: 'skill',
  },
  'cleaning-equipment': { evidenceClass: 'skill' },
  'cleaning-driver-licence': {
    concept: 'driver licence',
    evidenceClass: 'certification',
  },
  'cleaning-availability': { evidenceClass: 'availability' },
  'warehouse-pick-packing': {
    concept: 'pick packing experience',
    evidenceClass: 'skill',
  },
  'warehouse-rf-scanner': {
    concept: 'RF scanner',
    evidenceClass: 'skill',
  },
  'warehouse-inventory': {
    concept: 'inventory management',
    evidenceClass: 'skill',
  },
  'warehouse-manual-handling': {
    concept: 'manual handling',
    evidenceClass: 'skill',
  },
  'warehouse-forklift': {
    concept: 'forklift licence',
    evidenceClass: 'certification',
  },
  'warehouse-shifts': { evidenceClass: 'availability' },
  'software-languages': { evidenceClass: 'skill' },
  'software-frameworks': { evidenceClass: 'skill' },
  'software-databases': { evidenceClass: 'skill' },
  'software-cloud': { evidenceClass: 'skill' },
  'software-ci-cd': { evidenceClass: 'skill' },
  'software-github': { evidenceClass: 'general' },
  'software-projects': { evidenceClass: 'experience' },
  'software-team-experience': { evidenceClass: 'experience' },
  'accounting-software': { evidenceClass: 'skill' },
  'accounting-excel': { concept: 'Excel', evidenceClass: 'skill' },
  'accounting-payroll': {
    concept: 'payroll experience',
    evidenceClass: 'skill',
  },
  'accounting-ap-ar': { evidenceClass: 'skill' },
  'accounting-australian-standards': {
    concept: 'Australian accounting standards',
    evidenceClass: 'skill',
  },
  'accounting-credentials': { evidenceClass: 'certification' },
  'engineering-discipline': { evidenceClass: 'qualification' },
  'engineering-tools': { evidenceClass: 'skill' },
  'engineering-site-experience': {
    concept: 'engineering site experience',
    evidenceClass: 'experience',
  },
  'engineering-projects': { evidenceClass: 'experience' },
  'engineering-accreditation': { evidenceClass: 'certification' },
  'engineering-safety-tickets': { evidenceClass: 'certification' },
  'marketing-seo': { concept: 'SEO', evidenceClass: 'skill' },
  'marketing-paid-advertising': { evidenceClass: 'skill' },
  'marketing-analytics': { evidenceClass: 'skill' },
  'marketing-social-media': { evidenceClass: 'skill' },
  'marketing-content': { evidenceClass: 'skill' },
  'marketing-crm-email': { evidenceClass: 'skill' },
  'marketing-campaign-results': { evidenceClass: 'responsibility' },
  'general-related-work': { evidenceClass: 'experience' },
  'general-tools': { evidenceClass: 'skill' },
  'general-responsibilities': { evidenceClass: 'responsibility' },
  'general-licences': { evidenceClass: 'certification' },
  'general-availability': { evidenceClass: 'availability' },
};

const QUESTIONS_BY_KEY = new Map<string, OccupationQuestionDefinition>();

for (const profileId of OCCUPATION_PROFILE_IDS) {
  for (const group of occupationProfiles[profileId].groups) {
    for (const question of group.questions) {
      QUESTIONS_BY_KEY.set(`${profileId}:${question.id}`, question);
    }
  }
}

const DAY_LABELS: Readonly<Record<DayOfWeek, string>> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const EMPLOYMENT_TYPE_LABELS: Readonly<Record<EmploymentType, string>> = {
  casual: 'Casual work',
  'part-time': 'Part-time work',
  'full-time': 'Full-time work',
  contract: 'Contract work',
};

const SHIFT_LABELS: Readonly<Record<ShiftPreference, string>> = {
  morning: 'Morning shifts',
  afternoon: 'Afternoon shifts',
  evening: 'Evening shifts',
  overnight: 'Overnight shifts',
  flexible: 'Flexible shifts',
};

const EMPTY_ANSWER_PATTERN = /^(?:none|no|not yet|no experience(?: yet)?|n\/?a)$/i;

function experienceContext(entry: ExperienceEntry): string {
  const role = entry.roleTitle.trim() || 'Experience entry';
  const organisation = entry.organisation?.trim();
  return organisation ? `${role} at ${organisation}` : role;
}

function questionFor(answer: AdaptiveAnswer): OccupationQuestionDefinition | undefined {
  return QUESTIONS_BY_KEY.get(
    `${answer.occupationProfileId}:${answer.questionId}`,
  );
}

function createEvidenceCollector() {
  const items: CandidateEvidence[] = [];
  const usedIds = new Set<string>();

  function uniqueId(baseId: string): string {
    let candidate = `candidate-evidence:${baseId}`;
    let duplicateIndex = 2;

    while (usedIds.has(candidate)) {
      candidate = `candidate-evidence:${baseId}:${duplicateIndex}`;
      duplicateIndex += 1;
    }

    usedIds.add(candidate);
    return candidate;
  }

  function add(input: EvidenceInput) {
    const text = input.text.trim();
    const normalizedTerms = buildNormalizedTerms(input.termText ?? text);

    if (!text || normalizedTerms.length === 0) {
      return;
    }

    items.push({
      id: uniqueId(input.id),
      source: input.source,
      sourceId: input.sourceId,
      parentSourceId: input.parentSourceId,
      fieldPath: input.fieldPath,
      sourceLabel: input.sourceLabel,
      contextLabel: input.contextLabel,
      text,
      normalizedTerms,
      evidenceClass: input.evidenceClass,
      polarity: input.polarity ?? 'supports',
      strength: input.strength ?? 'direct',
      confirmed: true,
      metadata: input.metadata,
    });
  }

  return { items, add };
}

function addAdaptiveEvidence(
  answer: AdaptiveAnswer,
  add: (input: EvidenceInput) => void,
) {
  if (!answer.confirmed) {
    return;
  }

  const question = questionFor(answer);
  const rule = ADAPTIVE_EVIDENCE_RULES[answer.questionId];

  if (!question || !rule) {
    return;
  }

  const common = {
    source: 'adaptive-answer' as const,
    sourceId: answer.id,
    fieldPath: `adaptiveAnswers.${answer.id}`,
    sourceLabel: 'Confirmed answer',
    contextLabel: question.label,
    evidenceClass: rule.evidenceClass,
    metadata: {
      questionId: answer.questionId,
    },
  };

  switch (answer.answer.kind) {
    case 'boolean': {
      if (question.type !== 'boolean' || !rule.concept) {
        return;
      }

      add({
        ...common,
        id: `adaptive:${answer.id}`,
        text: `${question.label} ${answer.answer.value ? 'Yes' : 'No'}`,
        termText: rule.concept,
        polarity: answer.answer.value ? 'supports' : 'denies',
      });
      return;
    }

    case 'text': {
      if (question.type !== 'text') {
        return;
      }

      const value = answer.answer.value.trim();

      if (!value) {
        return;
      }

      if (EMPTY_ANSWER_PATTERN.test(value)) {
        if (rule.concept) {
          add({
            ...common,
            id: `adaptive:${answer.id}`,
            text: `${question.label} ${value}`,
            termText: rule.concept,
            polarity: 'denies',
          });
        }
        return;
      }

      add({
        ...common,
        id: `adaptive:${answer.id}`,
        text: value,
      });
      return;
    }

    case 'single-choice': {
      if (question.type !== 'single-select') {
        return;
      }

      const option = question.options.find(
        (candidate) => candidate.value === answer.answer.value,
      );

      if (!option || option.value === 'other') {
        return;
      }

      const isNegative = EMPTY_ANSWER_PATTERN.test(option.label);

      if (isNegative && !rule.concept) {
        return;
      }

      add({
        ...common,
        id: `adaptive:${answer.id}:option:${option.value}`,
        text: `${question.label} ${option.label}`,
        termText: rule.concept ?? option.label,
        polarity: isNegative ? 'denies' : 'supports',
      });
      return;
    }

    case 'multiple-choice': {
      if (question.type !== 'multi-select') {
        return;
      }

      for (const optionValue of answer.answer.value) {
        const option = question.options.find(
          (candidate) => candidate.value === optionValue,
        );

        if (!option || option.value === 'other') {
          continue;
        }

        const isWeekendAvailability =
          rule.evidenceClass === 'availability' &&
          option.value === 'weekends';

        add({
          ...common,
          id: `adaptive:${answer.id}:option:${option.value}`,
          text: option.label,
          termText: isWeekendAvailability
            ? 'weekend availability'
            : option.label,
        });
      }
      return;
    }

    case 'number':
      // No current occupation question has a bounded numeric contract. A bare
      // number is unsafe to interpret as experience or proficiency evidence.
      return;
  }
}

/**
 * Builds candidate evidence from a restricted candidate-only view of the
 * draft. Target job fields and job-ad analysis are not present in this input
 * type, so employer requirements cannot become candidate evidence.
 */
export function buildCandidateEvidenceIndex(
  draft: CandidateEvidenceInput,
): CandidateEvidenceIndex {
  const { items, add } = createEvidenceCollector();

  for (const skill of draft.skills) {
    add({
      id: `skill:${skill.id}:name`,
      source: 'skill',
      sourceId: skill.id,
      fieldPath: `skills.${skill.id}.name`,
      sourceLabel: 'Skill',
      text: skill.name,
      evidenceClass: 'skill',
    });
  }

  for (const entry of draft.experience) {
    const isProject =
      entry.kind === 'project' || entry.kind === 'education-project';
    const source: CandidateEvidenceSource = isProject
      ? 'project'
      : 'experience';
    const contextLabel = experienceContext(entry);

    add({
      id: `experience:${entry.id}:role`,
      source,
      sourceId: entry.id,
      fieldPath: `experience.${entry.id}.roleTitle`,
      sourceLabel: isProject ? 'Project' : 'Experience role',
      contextLabel,
      text: entry.roleTitle,
      evidenceClass: 'experience',
    });

    if (entry.description) {
      add({
        id: `experience:${entry.id}:description`,
        source,
        sourceId: entry.id,
        fieldPath: `experience.${entry.id}.description`,
        sourceLabel: isProject ? 'Project description' : 'Experience description',
        contextLabel,
        text: entry.description,
        evidenceClass: 'responsibility',
      });
    }

    for (const highlight of entry.highlights) {
      add({
        id: `experience:${entry.id}:highlight:${highlight.id}`,
        source: isProject ? 'project' : 'experience-highlight',
        sourceId: highlight.id,
        parentSourceId: entry.id,
        fieldPath: `experience.${entry.id}.highlights.${highlight.id}`,
        sourceLabel: isProject ? 'Project highlight' : 'Experience highlight',
        contextLabel,
        text: highlight.text,
        evidenceClass:
          highlight.category === 'skill-evidence'
            ? 'skill'
            : highlight.category === 'project'
              ? 'experience'
              : 'responsibility',
      });
    }
  }

  for (const education of draft.education) {
    const contextLabel = education.institution.trim()
      ? `${education.qualification.trim() || 'Education'} at ${education.institution.trim()}`
      : education.qualification.trim() || 'Education';
    const qualificationStrength =
      education.status === 'completed' ? 'direct' : 'contextual';

    add({
      id: `education:${education.id}:qualification`,
      source: 'education',
      sourceId: education.id,
      fieldPath: `education.${education.id}.qualification`,
      sourceLabel: 'Education',
      contextLabel,
      text: education.qualification,
      evidenceClass: 'qualification',
      strength: qualificationStrength,
      metadata: { status: education.status },
    });

    if (education.fieldOfStudy) {
      add({
        id: `education:${education.id}:field`,
        source: 'education',
        sourceId: education.id,
        fieldPath: `education.${education.id}.fieldOfStudy`,
        sourceLabel: 'Field of study',
        contextLabel,
        text: education.fieldOfStudy,
        evidenceClass: 'qualification',
        strength: 'contextual',
        metadata: { status: education.status },
      });
    }

    for (const highlight of education.highlights) {
      add({
        id: `education:${education.id}:highlight:${highlight.id}`,
        source: 'education',
        sourceId: highlight.id,
        parentSourceId: education.id,
        fieldPath: `education.${education.id}.highlights.${highlight.id}`,
        sourceLabel: 'Education highlight',
        contextLabel,
        text: highlight.text,
        evidenceClass: 'responsibility',
      });
    }
  }

  for (const licence of draft.licences) {
    add({
      id: `licence:${licence.id}:name`,
      source: 'licence',
      sourceId: licence.id,
      fieldPath: `licences.${licence.id}.name`,
      sourceLabel: 'Licence or certification',
      contextLabel: licence.issuer?.trim() || licence.jurisdiction?.trim(),
      text: licence.name,
      evidenceClass: 'certification',
      strength: licence.status === 'current' ? 'direct' : 'contextual',
      metadata: {
        status: licence.status,
        jurisdiction: licence.jurisdiction,
      },
    });
  }

  for (const day of draft.availability.days) {
    add({
      id: `availability:day:${day}`,
      source: 'availability',
      sourceId: 'availability',
      fieldPath: `availability.days.${day}`,
      sourceLabel: 'Availability',
      text: `Available on ${DAY_LABELS[day]}`,
      evidenceClass: 'availability',
    });
  }

  if (
    draft.availability.days.includes('saturday') &&
    draft.availability.days.includes('sunday')
  ) {
    add({
      id: 'availability:weekends',
      source: 'availability',
      sourceId: 'availability',
      fieldPath: 'availability.days',
      sourceLabel: 'Availability',
      text: 'Available on Saturday and Sunday',
      termText: 'weekend availability',
      evidenceClass: 'availability',
    });
  }

  for (const employmentType of draft.availability.employmentTypes) {
    add({
      id: `availability:employment-type:${employmentType}`,
      source: 'availability',
      sourceId: 'availability',
      fieldPath: `availability.employmentTypes.${employmentType}`,
      sourceLabel: 'Availability',
      text: EMPLOYMENT_TYPE_LABELS[employmentType],
      evidenceClass: 'availability',
    });
  }

  for (const shift of draft.availability.shifts) {
    add({
      id: `availability:shift:${shift}`,
      source: 'availability',
      sourceId: 'availability',
      fieldPath: `availability.shifts.${shift}`,
      sourceLabel: 'Availability',
      text: SHIFT_LABELS[shift],
      evidenceClass: 'availability',
    });
  }

  if (draft.availability.notes) {
    add({
      id: 'availability:notes',
      source: 'availability',
      sourceId: 'availability',
      fieldPath: 'availability.notes',
      sourceLabel: 'Availability note',
      text: draft.availability.notes,
      evidenceClass: 'availability',
    });
  }

  for (const answer of draft.adaptiveAnswers) {
    addAdaptiveEvidence(answer, add);
  }

  return { items };
}

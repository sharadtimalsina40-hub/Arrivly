import {
  areStrictControlledEquivalents,
  buildNormalizedTerms,
  findEquivalentMatch,
  isAvailabilityRequirementLabel,
  isFormalCredentialRequirementLabel,
  isFormalQualificationRequirementLabel,
  normalizeMatchText,
} from '../matching/normalize';
import type {
  JobMatchResult,
  RequirementImportance,
  RequirementMatch,
} from '../matching/types';
import {
  MAX_FOLLOW_UP_QUESTIONS,
  type FollowUpQuestion,
  type FollowUpQuestionBatch,
  type FollowUpQuestionKind,
} from './types';

const IMPORTANCE_ORDER: Readonly<Record<RequirementImportance, number>> = {
  required: 0,
  preferred: 1,
  unspecified: 2,
};

const SENSITIVE_REQUIREMENT_PATTERN =
  /\b(?:age|date of birth|gender|marital status|photo(?:graph)?|tax file number|tfn|passport(?: number)?)\b/;

function cleanRequirement(value: string): string {
  return value.replace(/[.?!]+$/g, '').trim();
}

function areSafelyEquivalent(
  first: RequirementMatch,
  second: RequirementMatch,
): boolean {
  return (
    questionKind(first) === questionKind(second) &&
    areStrictControlledEquivalents(
      first.requirement.label,
      second.requirement.label,
    )
  );
}

function isFormalQualification(match: RequirementMatch): boolean {
  if (match.requirement.type === 'qualification') {
    return true;
  }

  return isFormalQualificationRequirementLabel(match.requirement.label);
}

function isEquivalentTo(value: string, concept: string): boolean {
  return Boolean(findEquivalentMatch(concept, buildNormalizedTerms(value)));
}

function questionKind(match: RequirementMatch): FollowUpQuestionKind {
  const requirement = match.requirement.label;

  if (
    match.requirement.type === 'certification' ||
    isFormalCredentialRequirementLabel(requirement)
  ) {
    return 'licence-certification';
  }

  if (isFormalQualification(match)) {
    return 'qualification';
  }

  if (isAvailabilityRequirementLabel(requirement)) {
    return 'availability';
  }

  if (isEquivalentTo(requirement, 'POS')) {
    return 'tool-system';
  }

  if (
    match.requirement.type === 'experience' ||
    match.requirement.type === 'responsibility'
  ) {
    return 'experience';
  }

  if (
    match.requirement.type === 'required-skill' ||
    match.requirement.type === 'preferred-skill' ||
    match.requirement.type === 'soft-skill'
  ) {
    return 'skill';
  }

  return 'general';
}

function wording(
  match: RequirementMatch,
  kind: FollowUpQuestionKind,
): Pick<FollowUpQuestion, 'question' | 'detailsPrompt' | 'allowsDepends'> {
  const requirement = cleanRequirement(match.requirement.label);

  switch (kind) {
    case 'licence-certification':
      return {
        question: `Do you currently hold a valid ${requirement}?`,
        detailsPrompt: 'Where was it issued, and when does it expire if known?',
        allowsDepends: false,
      };
    case 'qualification':
      return {
        question: `Do you currently hold ${requirement}?`,
        detailsPrompt: 'Briefly state where and when you completed it.',
        allowsDepends: false,
      };
    case 'availability':
      return {
        question: /weekend/.test(normalizeMatchText(requirement))
          ? 'Are you available to work weekends?'
          : `Can you meet this availability requirement: ${requirement}?`,
        detailsPrompt: 'Add any useful limits or context about your availability.',
        allowsDepends: true,
      };
    case 'tool-system':
      return {
        question: 'Have you used a POS or cash register system?',
        detailsPrompt: 'Where or how did you use it?',
        allowsDepends: false,
      };
    case 'experience':
      return {
        question: isEquivalentTo(requirement, 'customer service')
          ? 'Have you worked directly with customers before?'
          : `Do you have experience that directly supports ${requirement}?`,
        detailsPrompt: 'Tell us briefly where or what you did.',
        allowsDepends: false,
      };
    case 'skill':
      return {
        question: isEquivalentTo(requirement, 'customer service')
          ? 'Have you worked directly with customers before?'
          : `Have you used ${requirement} before?`,
        detailsPrompt: isEquivalentTo(requirement, 'customer service')
          ? 'Tell us briefly where or what you did.'
          : `Where or how have you used ${requirement}?`,
        allowsDepends: false,
      };
    case 'general':
      return {
        question: `Can you confirm that you meet this requirement: ${requirement}?`,
        detailsPrompt: 'Add a brief factual example or context if useful.',
        allowsDepends: false,
      };
  }
}

interface MutableQuestionGroup {
  readonly primary: RequirementMatch;
  readonly covered: RequirementMatch[];
}

/** Pure deterministic generation from the canonical-only baseline match. */
export function buildFollowUpQuestionBatch(
  result: JobMatchResult,
  limit = MAX_FOLLOW_UP_QUESTIONS,
): FollowUpQuestionBatch {
  const eligible = result.matches
    .filter(
      (match) =>
        match.status === 'unresolved' &&
        match.basis !== 'conflict' &&
        !SENSITIVE_REQUIREMENT_PATTERN.test(
          normalizeMatchText(match.requirement.label),
        ),
    )
    .map((match, sourceOrder) => ({ match, sourceOrder }))
    .sort(
      (first, second) =>
        IMPORTANCE_ORDER[first.match.requirement.importance] -
          IMPORTANCE_ORDER[second.match.requirement.importance] ||
        first.sourceOrder - second.sourceOrder,
    )
    .map(({ match }) => match);

  const groups: MutableQuestionGroup[] = [];

  for (const match of eligible) {
    const existing = groups.find((group) =>
      areSafelyEquivalent(group.primary, match),
    );

    if (existing) {
      existing.covered.push(match);
    } else {
      groups.push({ primary: match, covered: [match] });
    }
  }

  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : MAX_FOLLOW_UP_QUESTIONS;
  const selectedGroups = groups.slice(0, safeLimit);
  const questions = selectedGroups.map(({ primary, covered }) => {
    const kind = questionKind(primary);
    const copy = wording(primary, kind);
    const coveredRequirementIds = covered.map(
      (match) => match.requirement.id,
    ) as [string, ...string[]];
    const coveredRequirements = covered.map(
      (match) => match.requirement.label,
    ) as [string, ...string[]];

    return {
      id: `follow-up:${primary.requirement.id}`,
      requirementId: primary.requirement.id,
      coveredRequirementIds,
      requirement: primary.requirement.label,
      coveredRequirements,
      requirementType: primary.requirement.type,
      priority: primary.requirement.importance,
      kind,
      ...copy,
    } satisfies FollowUpQuestion;
  });

  return {
    questions,
    totalEligible: groups.length,
    truncated: groups.length > questions.length,
  };
}

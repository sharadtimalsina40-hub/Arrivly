import { buildNormalizedTerms } from '../matching/normalize';
import type {
  CandidateEvidence,
  CandidateEvidenceClass,
  CandidateEvidenceIndex,
  RequirementConfirmation,
  RequirementConfirmationIndex,
} from '../matching/types';
import type {
  ConfirmedFollowUpEvidence,
  FollowUpQuestion,
  FollowUpState,
} from './types';

function answerFor(state: FollowUpState, questionId: string) {
  return state.answers.find((answer) => answer.questionId === questionId);
}

function nonBlankExact(value: string): string | undefined {
  return value.trim() ? value : undefined;
}

const YEAR_MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const AUSTRALIAN_YEAR_MONTH_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  year: 'numeric',
  month: '2-digit',
});

export type FollowUpExpiryIssue = 'invalid' | 'past';

export function getAustralianYearMonth(date = new Date()): string {
  const parts = AUSTRALIAN_YEAR_MONTH_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;

  if (!year || !month) {
    throw new Error('Could not determine the current Australian month.');
  }

  return `${year}-${month}`;
}

export function getFollowUpExpiryIssue(
  expiryDate: string,
  asOfYearMonth: string,
): FollowUpExpiryIssue | undefined {
  if (
    !YEAR_MONTH_PATTERN.test(expiryDate) ||
    !YEAR_MONTH_PATTERN.test(asOfYearMonth)
  ) {
    return 'invalid';
  }

  return expiryDate < asOfYearMonth ? 'past' : undefined;
}

/** Builds positive evidence only from committed Yes answers. */
export function buildConfirmedFollowUpEvidence(
  questions: readonly FollowUpQuestion[],
  state: FollowUpState,
  asOfYearMonth: string,
): readonly ConfirmedFollowUpEvidence[] {
  return questions.flatMap((question) => {
    const answer = answerFor(state, question.id);

    if (
      !answer ||
      answer.status !== 'confirmed' ||
      answer.response !== 'yes'
    ) {
      return [];
    }

    const details = nonBlankExact(answer.details);
    const jurisdiction = nonBlankExact(answer.jurisdiction);
    const expiryDate = nonBlankExact(answer.expiryDate);

    // A Yes to a currently valid credential cannot become positive proof when
    // the supplied expiry month is already past. The UI prevents this state;
    // this guard also protects programmatic or restored session data.
    if (
      question.kind === 'licence-certification' &&
      expiryDate &&
      getFollowUpExpiryIssue(expiryDate, asOfYearMonth)
    ) {
      return [];
    }

    return [
      {
        id: `follow-up-evidence:${question.id}`,
        questionId: question.id,
        requirementId: question.requirementId,
        coveredRequirementIds: question.coveredRequirementIds,
        requirement: question.requirement,
        coveredRequirements: question.coveredRequirements,
        requirementType: question.requirementType,
        questionKind: question.kind,
        text: details ?? 'Yes',
        response: 'yes',
        details,
        jurisdiction,
        expiryDate,
        source: 'follow-up',
        userConfirmed: true,
      },
    ];
  });
}

function evidenceClassFor(
  question: FollowUpQuestion,
): CandidateEvidenceClass {
  switch (question.kind) {
    case 'licence-certification':
      return 'certification';
    case 'qualification':
      return 'qualification';
    case 'availability':
      return 'availability';
    case 'experience':
      return 'experience';
    case 'skill':
    case 'tool-system':
      return 'skill';
    case 'general':
      return 'general';
  }
}

export function followUpEvidenceToCandidateEvidence(
  evidence: readonly ConfirmedFollowUpEvidence[],
  questions: readonly FollowUpQuestion[],
): readonly CandidateEvidence[] {
  const questionsById = new Map(
    questions.map((question) => [question.id, question] as const),
  );

  return evidence.flatMap((item) => {
    const question = questionsById.get(item.questionId);

    if (!question) {
      return [];
    }

    const normalizedTerms = Array.from(
      new Set(
        [
          question.requirement,
          ...item.coveredRequirements,
          item.details ?? '',
        ].flatMap(buildNormalizedTerms),
      ),
    );

    return [
      {
        id: `candidate-evidence:${item.id}`,
        source: 'follow-up',
        sourceId: item.id,
        fieldPath: `followUp.answers.${item.questionId}`,
        sourceLabel: 'Confirmed follow-up answer',
        contextLabel: question.question,
        text: item.text,
        normalizedTerms,
        evidenceClass: evidenceClassFor(question),
        polarity: 'supports',
        strength: 'direct',
        confirmed: true,
        metadata: {
          status: 'confirmed',
          jurisdiction: item.jurisdiction,
          questionId: item.questionId,
          requirementId: item.requirementId,
          requirementIds: item.coveredRequirementIds,
          response: 'yes',
          details: item.details,
          expiryDate: item.expiryDate,
        },
      } satisfies CandidateEvidence,
    ];
  });
}

/** A committed No is provenance for matching, but never CandidateEvidence. */
export function buildFollowUpConfirmationIndex(
  questions: readonly FollowUpQuestion[],
  state: FollowUpState,
): RequirementConfirmationIndex {
  const items: RequirementConfirmation[] = questions.flatMap((question) => {
    const answer = answerFor(state, question.id);

    if (!answer || answer.status !== 'declined' || answer.response !== 'no') {
      return [];
    }

    return [
      {
        id: `follow-up-confirmation:${question.id}`,
        source: 'follow-up',
        questionId: question.id,
        requirementIds: question.coveredRequirementIds,
        response: 'no',
        text: 'No',
        sourceLabel: 'Confirmed follow-up answer',
        userConfirmed: true,
      },
    ];
  });

  return { items };
}

export function addFollowUpEvidence(
  base: CandidateEvidenceIndex,
  followUpEvidence: readonly CandidateEvidence[],
): CandidateEvidenceIndex {
  return followUpEvidence.length === 0
    ? base
    : { items: [...base.items, ...followUpEvidence] };
}

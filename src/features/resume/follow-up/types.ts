import type {
  RequirementImportance,
  RequirementType,
} from '../matching/types';

export const FOLLOW_UP_SCHEMA_VERSION = 1 as const;
export const MAX_FOLLOW_UP_QUESTIONS = 5;

export type FollowUpResponse =
  | 'yes'
  | 'no'
  | 'not-sure'
  | 'depends';

export type FollowUpAnswerStatus =
  | 'unanswered'
  | 'confirmed'
  | 'declined'
  | 'uncertain'
  | 'skipped';

export type FollowUpQuestionKind =
  | 'skill'
  | 'tool-system'
  | 'experience'
  | 'licence-certification'
  | 'qualification'
  | 'availability'
  | 'general';

/** Immutable question definition generated from a baseline requirement match. */
export interface FollowUpQuestion {
  readonly id: string;
  readonly requirementId: string;
  /** Safely equivalent requirements covered by the same answer. */
  readonly coveredRequirementIds: readonly [string, ...string[]];
  readonly requirement: string;
  readonly coveredRequirements: readonly [string, ...string[]];
  readonly requirementType: RequirementType;
  /** `unspecified` is retained honestly when JobAnalysisV1 lacks priority. */
  readonly priority: RequirementImportance;
  readonly kind: FollowUpQuestionKind;
  readonly question: string;
  readonly detailsPrompt: string;
  readonly allowsDepends: boolean;
}

export interface FollowUpQuestionBatch {
  readonly questions: readonly FollowUpQuestion[];
  readonly totalEligible: number;
  readonly truncated: boolean;
}

/** Session-only answer state. It is deliberately not part of ResumeDraftV1. */
export interface FollowUpAnswer {
  readonly questionId: string;
  readonly response?: FollowUpResponse;
  readonly details: string;
  readonly jurisdiction: string;
  readonly expiryDate: string;
  readonly status: FollowUpAnswerStatus;
}

export interface FollowUpState {
  readonly schemaVersion: typeof FOLLOW_UP_SCHEMA_VERSION;
  /** Exact analysed-ad key. Answers from another ad are never reused. */
  readonly contextKey: string | null;
  readonly answers: readonly FollowUpAnswer[];
  readonly activeQuestionId: string | null;
}

/** A positive fact created only from a committed, explicit Yes answer. */
export interface ConfirmedFollowUpEvidence {
  readonly id: string;
  readonly questionId: string;
  readonly requirementId: string;
  readonly coveredRequirementIds: readonly [string, ...string[]];
  readonly requirement: string;
  readonly coveredRequirements: readonly [string, ...string[]];
  readonly requirementType: RequirementType;
  readonly questionKind: FollowUpQuestionKind;
  /** Exact displayed answer text: user details when supplied, otherwise Yes. */
  readonly text: string;
  readonly response: 'yes';
  readonly details?: string;
  readonly jurisdiction?: string;
  readonly expiryDate?: string;
  readonly source: 'follow-up';
  readonly userConfirmed: true;
}

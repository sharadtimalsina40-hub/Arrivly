import type { JobAnalysisV1 } from '../ai/job-analysis/types';
import type { ResumeDraftV1 } from '../model/types';

export const JOB_MATCH_RESULT_SCHEMA_VERSION = 1 as const;

/** Candidate-owned fields that the evidence builder is allowed to inspect. */
export type CandidateEvidenceInput = Pick<
  ResumeDraftV1,
  | 'experience'
  | 'education'
  | 'licences'
  | 'skills'
  | 'availability'
  | 'adaptiveAnswers'
>;

export type CandidateEvidenceSource =
  | 'skill'
  | 'experience'
  | 'experience-highlight'
  | 'education'
  | 'licence'
  | 'adaptive-answer'
  | 'project'
  | 'availability'
  | 'follow-up';

export type CandidateEvidenceClass =
  | 'skill'
  | 'responsibility'
  | 'experience'
  | 'qualification'
  | 'certification'
  | 'availability'
  | 'general';

export type CandidateEvidencePolarity = 'supports' | 'denies';
export type CandidateEvidenceStrength = 'direct' | 'contextual';

export interface CandidateEvidence {
  /** Stable internal reference used by RequirementMatch. Never shown to users. */
  readonly id: string;
  readonly source: CandidateEvidenceSource;
  /** ID of the actual draft item or confirmed answer that supplied the text. */
  readonly sourceId: string;
  readonly parentSourceId?: string;
  /** Internal provenance path. It is deliberately separate from display copy. */
  readonly fieldPath: string;
  /** Safe human-readable provenance for the review UI. */
  readonly sourceLabel: string;
  readonly contextLabel?: string;
  /** Candidate-owned text; employer/job-ad text can never enter this field. */
  readonly text: string;
  readonly normalizedTerms: readonly string[];
  readonly evidenceClass: CandidateEvidenceClass;
  readonly polarity: CandidateEvidencePolarity;
  readonly strength: CandidateEvidenceStrength;
  /** Only user-entered facts and explicitly confirmed adaptive answers are indexed. */
  readonly confirmed: true;
  readonly metadata?: {
    readonly status?: string;
    readonly jurisdiction?: string;
    readonly questionId?: string;
    readonly requirementId?: string;
    readonly requirementIds?: readonly string[];
    readonly response?: 'yes';
    readonly details?: string;
    readonly expiryDate?: string;
  };
}

export interface CandidateEvidenceIndex {
  readonly items: readonly CandidateEvidence[];
}

export type RequirementType =
  | 'required-skill'
  | 'preferred-skill'
  | 'qualification'
  | 'certification'
  | 'responsibility'
  | 'soft-skill'
  | 'experience'
  | 'other-requirement';

export type RequirementImportance =
  | 'required'
  | 'preferred'
  | 'unspecified';

export type MatchStatus =
  | 'matched'
  | 'related'
  | 'unresolved'
  | 'confirmed-missing';

export type MatchBasis =
  | 'exact'
  | 'controlled-alias'
  | 'controlled-related'
  | 'context-only'
  | 'explicit-negative'
  | 'follow-up-decline'
  | 'conflict'
  | 'no-evidence'
  | 'unsafe-to-infer';

export type MatchableJobAnalysisSection = Exclude<
  keyof JobAnalysisV1,
  'schemaVersion' | 'jobTitle' | 'employer' | 'keywords'
>;

export interface JobRequirementReference {
  readonly id: string;
  readonly label: string;
  readonly type: RequirementType;
  readonly importance: RequirementImportance;
  /** Exact employer wording retained as requirement provenance. */
  readonly employerEvidenceText: string;
  readonly sourceSection: MatchableJobAnalysisSection;
  readonly sourceIndex: number;
}

interface RequirementMatchBase {
  readonly requirement: JobRequirementReference;
  readonly explanation: string;
  /** References to explicit job-specific decisions, never candidate facts. */
  readonly confirmationRefs: readonly string[];
}

export type RequirementMatch =
  | (RequirementMatchBase & {
      readonly status: 'matched';
      readonly basis: 'exact' | 'controlled-alias';
      readonly evidenceRefs: readonly [string, ...string[]];
    })
  | (RequirementMatchBase & {
      readonly status: 'related';
      readonly basis:
        | 'controlled-related'
        | 'context-only'
        | 'unsafe-to-infer';
      readonly evidenceRefs: readonly [string, ...string[]];
    })
  | (RequirementMatchBase & {
      readonly status: 'unresolved';
      readonly basis: 'conflict' | 'no-evidence' | 'unsafe-to-infer';
      readonly evidenceRefs: readonly string[];
    })
  | (RequirementMatchBase & {
      readonly status: 'confirmed-missing';
      readonly basis: 'explicit-negative' | 'follow-up-decline';
      readonly evidenceRefs: readonly string[];
    });

/**
 * An explicit user decision about a requirement that is kept separate from
 * candidate evidence. Phase 3 uses this for a confirmed "No" response.
 */
export interface RequirementConfirmation {
  readonly id: string;
  readonly source: 'follow-up';
  readonly questionId: string;
  readonly requirementIds: readonly [string, ...string[]];
  readonly response: 'no';
  readonly text: 'No';
  readonly sourceLabel: string;
  readonly userConfirmed: true;
}

export interface RequirementConfirmationIndex {
  readonly items: readonly RequirementConfirmation[];
}

export interface MatchStatusCounts {
  readonly total: number;
  readonly matched: number;
  readonly related: number;
  readonly unresolved: number;
  readonly confirmedMissing: number;
}

export interface JobMatchSummary {
  readonly required: MatchStatusCounts;
  readonly preferred: MatchStatusCounts;
  readonly unspecified: MatchStatusCounts;
}

export interface FollowUpCandidate {
  readonly id: string;
  readonly requirementId: string;
  readonly requirement: string;
  readonly requirementType: RequirementType;
  readonly question: string;
  readonly reason: string;
}

export interface JobMatchResult {
  readonly schemaVersion: typeof JOB_MATCH_RESULT_SCHEMA_VERSION;
  readonly evidenceIndex: CandidateEvidenceIndex;
  readonly confirmationIndex: RequirementConfirmationIndex;
  readonly matches: readonly RequirementMatch[];
  readonly summary: JobMatchSummary;
  readonly followUpCandidates: readonly FollowUpCandidate[];
}

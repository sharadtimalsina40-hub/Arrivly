import type { JobAnalysisV1 } from '../job-analysis/types';
import type {
  CandidateEvidenceClass,
  CandidateEvidenceSource,
  CandidateEvidenceStrength,
} from '../../matching/types';

export const GENERATED_RESUME_PROPOSAL_SCHEMA_VERSION = 1 as const;

export interface GeneratedText {
  readonly text: string;
  readonly sourceRefs: readonly string[];
}

export interface GeneratedExperience {
  readonly experienceId: string;
  readonly bullets: readonly GeneratedText[];
}

/** Untrusted provider output after structural and evidence-grounding checks. */
export interface GeneratedResumeProposal {
  readonly schemaVersion: typeof GENERATED_RESUME_PROPOSAL_SCHEMA_VERSION;
  readonly summary: GeneratedText | null;
  readonly experience: readonly GeneratedExperience[];
  readonly suggestedSkills: readonly GeneratedText[];
}

/** Candidate-only facts deliberately minimised before an AI request. */
export interface ResumeWritingResumeContext {
  readonly targetJobTitle: string | null;
  readonly experience: readonly {
    readonly id: string;
    readonly roleTitle: string | null;
    readonly description: string | null;
    readonly highlights: readonly {
      readonly sourceFactId: string;
      readonly text: string;
    }[];
  }[];
  readonly education: readonly {
    readonly id: string;
    readonly qualification: string | null;
    readonly fieldOfStudy: string | null;
    readonly statusLine: string;
    readonly highlights: readonly {
      readonly sourceFactId: string;
      readonly text: string;
    }[];
  }[];
  readonly skills: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly licences: readonly {
    readonly id: string;
    readonly name: string | null;
    readonly statusLine: string;
  }[];
}

/**
 * Minimal, positive candidate evidence sent to the writing service.
 * Employer wording and negative/uncertain facts cannot enter this contract.
 */
export interface ResumeWritingEvidence {
  readonly id: string;
  readonly source: CandidateEvidenceSource;
  readonly sourceId: string;
  readonly parentSourceId: string | null;
  readonly text: string;
  readonly normalizedTerms: readonly string[];
  readonly evidenceClass: CandidateEvidenceClass;
  readonly strength: CandidateEvidenceStrength;
  readonly confirmed: true;
}

export interface ResumeWritingInput {
  readonly analysis: JobAnalysisV1;
  readonly resume: ResumeWritingResumeContext;
  readonly candidateEvidence: readonly ResumeWritingEvidence[];
  readonly confirmedFollowUpEvidence: readonly ResumeWritingEvidence[];
}

export type ResumeWritingRejectionCode =
  | 'unknown-source-ref'
  | 'duplicate-source-ref'
  | 'wrong-experience'
  | 'unsupported-number'
  | 'unsupported-requirement'
  | 'unsupported-formal-claim'
  | 'unsupported-claim-language'
  | 'unsupported-term'
  | 'cross-evidence-recombination'
  | 'invalid-skill-suggestion';

export interface ResumeWritingRejection {
  readonly path: string;
  readonly code: ResumeWritingRejectionCode;
}

export interface ValidatedResumeWritingResult {
  readonly proposal: GeneratedResumeProposal;
  /** Invalid statements are counted but their untrusted text is not returned. */
  readonly rejectedStatements: number;
}

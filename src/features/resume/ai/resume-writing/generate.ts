import { validateGeneratedResumeProposal } from './grounding';
import { buildResumeWritingPrompt, type ResumeWritingPrompt } from './prompt';
import { parseResumeWritingInput } from './schema';
import type {
  ResumeWritingInput,
  ValidatedResumeWritingResult,
} from './types';

export interface GenerateResumeWritingProviderInput {
  readonly prompt: ResumeWritingPrompt;
  readonly signal?: AbortSignal;
}

export interface ResumeWritingProvider {
  generate(
    input: GenerateResumeWritingProviderInput,
  ): Promise<unknown>;
}

export interface GenerateResumeProposalOptions {
  readonly signal?: AbortSignal;
}

export class ResumeWritingEmptyEvidenceError extends Error {
  readonly code = 'EMPTY_CANDIDATE_EVIDENCE' as const;

  constructor() {
    super(
      'Add or confirm some resume details before generating tailored suggestions.',
    );
    this.name = 'ResumeWritingEmptyEvidenceError';
  }
}

/**
 * Runs one provider request, then treats its structured result as untrusted
 * until deterministic provenance and claim checks have removed unsafe text.
 */
export async function generateEvidenceGroundedResumeProposal(
  untrustedInput: ResumeWritingInput,
  provider: ResumeWritingProvider,
  options: GenerateResumeProposalOptions = {},
): Promise<ValidatedResumeWritingResult> {
  const input = parseResumeWritingInput(untrustedInput);

  if (
    input.candidateEvidence.length === 0 &&
    input.confirmedFollowUpEvidence.length === 0
  ) {
    throw new ResumeWritingEmptyEvidenceError();
  }

  const untrustedProposal = await provider.generate({
    prompt: buildResumeWritingPrompt(input),
    signal: options.signal,
  });

  return validateGeneratedResumeProposal(untrustedProposal, input);
}


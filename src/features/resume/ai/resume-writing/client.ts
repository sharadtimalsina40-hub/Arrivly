import { validateGeneratedResumeProposal } from './grounding';
import { parseResumeWritingInput } from './schema';
import type {
  ResumeWritingInput,
  ValidatedResumeWritingResult,
} from './types';

const RESUME_PROPOSAL_ENDPOINT = '/api/resume/generate-proposal';

type ResumeWritingClientErrorCode =
  | 'INVALID_REQUEST'
  | 'REQUEST_NOT_ALLOWED'
  | 'REQUEST_TOO_LARGE'
  | 'EMPTY_EVIDENCE'
  | 'RATE_LIMITED'
  | 'INVALID_AI_RESPONSE'
  | 'GENERATION_FAILED'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

const KNOWN_ERROR_CODES = new Set<string>([
  'INVALID_REQUEST',
  'REQUEST_NOT_ALLOWED',
  'REQUEST_TOO_LARGE',
  'EMPTY_EVIDENCE',
  'RATE_LIMITED',
  'INVALID_AI_RESPONSE',
  'GENERATION_FAILED',
  'SERVICE_UNAVAILABLE',
]);

export class ResumeWritingClientError extends Error {
  readonly code: ResumeWritingClientErrorCode;

  constructor(code: ResumeWritingClientErrorCode, message: string) {
    super(message);
    this.name = 'ResumeWritingClientError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readApiError(input: unknown): ResumeWritingClientError | undefined {
  if (!isRecord(input) || input.success !== false || !isRecord(input.error)) {
    return undefined;
  }
  const code = input.error.code;
  const message = input.error.message;
  if (
    typeof code !== 'string' ||
    !KNOWN_ERROR_CODES.has(code) ||
    typeof message !== 'string' ||
    !message.trim() ||
    message.length > 300
  ) {
    return undefined;
  }
  return new ResumeWritingClientError(
    code as ResumeWritingClientErrorCode,
    message.trim(),
  );
}

export function parseResumeProposalApiResponse(
  input: unknown,
  sourceInput: ResumeWritingInput,
): ValidatedResumeWritingResult {
  const apiError = readApiError(input);
  if (apiError) {
    throw apiError;
  }
  if (
    !isRecord(input) ||
    input.success !== true ||
    !('proposal' in input) ||
    typeof input.rejectedStatements !== 'number' ||
    !Number.isSafeInteger(input.rejectedStatements) ||
    input.rejectedStatements < 0
  ) {
    throw new ResumeWritingClientError(
      'INVALID_RESPONSE',
      'The writing service returned an unexpected response. Please try again.',
    );
  }

  try {
    // A compromised or stale response must pass the same grounding boundary in
    // the browser before any text can be displayed.
    const revalidated = validateGeneratedResumeProposal(
      input.proposal,
      sourceInput,
    );
    return {
      proposal: revalidated.proposal,
      rejectedStatements:
        input.rejectedStatements + revalidated.rejectedStatements,
    };
  } catch {
    throw new ResumeWritingClientError(
      'INVALID_RESPONSE',
      'The writing service returned an unsafe response. No suggestions were applied.',
    );
  }
}

export async function requestResumeWritingProposal(
  untrustedInput: ResumeWritingInput,
  options: { readonly signal: AbortSignal },
): Promise<ValidatedResumeWritingResult> {
  const input = parseResumeWritingInput(untrustedInput);
  let response: Response;

  try {
    response = await fetch(RESUME_PROPOSAL_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal.aborted) {
      throw error;
    }
    throw new ResumeWritingClientError(
      'NETWORK_ERROR',
      'We couldn’t reach the writing service. Check your connection and try again.',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ResumeWritingClientError(
      'INVALID_RESPONSE',
      'The writing service returned an unexpected response. Please try again.',
    );
  }

  if (!response.ok) {
    throw (
      readApiError(payload) ??
      new ResumeWritingClientError(
        'GENERATION_FAILED',
        'We couldn’t create resume suggestions. Please try again.',
      )
    );
  }

  return parseResumeProposalApiResponse(payload, input);
}


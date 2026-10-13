import {
  AnalyseJobRequestValidationError,
  parseAnalyseJobRequest,
} from './request';
import {
  JobAnalysisValidationError,
  parseJobAnalysis,
} from './schema';
import type { JobAnalysisV1 } from './types';

const ANALYSE_JOB_ENDPOINT = '/api/resume/analyse-job';

type JobAnalysisClientErrorCode =
  | 'INVALID_REQUEST'
  | 'EMPTY_JOB_AD'
  | 'JOB_AD_TOO_LONG'
  | 'REQUEST_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'INVALID_AI_RESPONSE'
  | 'ANALYSIS_FAILED'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

const JOB_ANALYSIS_CLIENT_ERROR_CODES: ReadonlySet<string> = new Set([
  'INVALID_REQUEST',
  'EMPTY_JOB_AD',
  'JOB_AD_TOO_LONG',
  'REQUEST_NOT_ALLOWED',
  'RATE_LIMITED',
  'INVALID_AI_RESPONSE',
  'ANALYSIS_FAILED',
  'SERVICE_UNAVAILABLE',
]);

function isJobAnalysisClientErrorCode(
  value: string,
): value is JobAnalysisClientErrorCode {
  return JOB_ANALYSIS_CLIENT_ERROR_CODES.has(value);
}

export class JobAnalysisClientError extends Error {
  readonly code: JobAnalysisClientErrorCode;

  constructor(code: JobAnalysisClientErrorCode, message: string) {
    super(message);
    this.name = 'JobAnalysisClientError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readApiError(
  input: unknown,
): { code: JobAnalysisClientErrorCode; message: string } | undefined {
  if (!isRecord(input) || input.success !== false || !isRecord(input.error)) {
    return undefined;
  }

  const code = input.error.code;
  const message = input.error.message;

  if (
    typeof code !== 'string' ||
    !isJobAnalysisClientErrorCode(code) ||
    typeof message !== 'string' ||
    message.trim().length === 0 ||
    message.length > 300
  ) {
    return undefined;
  }

  return {
    code,
    message: message.trim(),
  };
}

/**
 * Parses the provider-neutral Arrivly API envelope, then validates and grounds
 * the untrusted analysis against the same advertisement sent in the request.
 */
export function parseAnalyseJobApiResponse(
  input: unknown,
  sourceJobAdvertisement: string,
): JobAnalysisV1 {
  const apiError = readApiError(input);

  if (apiError) {
    throw new JobAnalysisClientError(apiError.code, apiError.message);
  }

  if (!isRecord(input) || input.success !== true || !('analysis' in input)) {
    throw new JobAnalysisClientError(
      'INVALID_RESPONSE',
      'The analysis service returned an unexpected response. Please try again.',
    );
  }

  try {
    return parseJobAnalysis(input.analysis, sourceJobAdvertisement);
  } catch (error: unknown) {
    if (error instanceof JobAnalysisValidationError) {
      throw new JobAnalysisClientError(
        'INVALID_RESPONSE',
        'The analysis service returned an unexpected response. Please try again.',
      );
    }

    throw error;
  }
}

export interface RequestJobAnalysisOptions {
  signal: AbortSignal;
}

/** Requests extraction only. It never receives or returns ResumeDraftV1. */
export async function requestJobAdvertisementAnalysis(
  jobAdvertisement: string,
  options: RequestJobAnalysisOptions,
): Promise<JobAnalysisV1> {
  let request;

  try {
    request = parseAnalyseJobRequest({ jobAd: jobAdvertisement });
  } catch (error: unknown) {
    if (error instanceof AnalyseJobRequestValidationError) {
      throw new JobAnalysisClientError(error.code, error.message);
    }

    throw error;
  }

  let response: Response;

  try {
    response = await fetch(ANALYSE_JOB_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      cache: 'no-store',
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (error: unknown) {
    if (options.signal.aborted) {
      throw error;
    }

    throw new JobAnalysisClientError(
      'NETWORK_ERROR',
      'We couldn’t reach the analysis service. Check your connection and try again.',
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new JobAnalysisClientError(
      'INVALID_RESPONSE',
      'The analysis service returned an unexpected response. Please try again.',
    );
  }

  if (!response.ok) {
    const apiError = readApiError(payload);

    if (apiError) {
      throw new JobAnalysisClientError(apiError.code, apiError.message);
    }

    throw new JobAnalysisClientError(
      'ANALYSIS_FAILED',
      'We couldn’t analyse this job advertisement. Please try again.',
    );
  }

  return parseAnalyseJobApiResponse(payload, request.jobAd);
}

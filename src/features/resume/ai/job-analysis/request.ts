import { z } from 'zod';
import { JOB_AD_MAX_CHARACTERS } from './types';

export { JOB_AD_MAX_CHARACTERS } from './types';

export const analyseJobRequestSchema = z
  .object({
    jobAd: z
      .string()
      .trim()
      .min(1, 'Paste a job advertisement before analysing it')
      .max(
        JOB_AD_MAX_CHARACTERS,
        `Job advertisements cannot exceed ${JOB_AD_MAX_CHARACTERS.toLocaleString('en-AU')} characters`,
      ),
  })
  .strict();

export type AnalyseJobRequest = z.infer<typeof analyseJobRequestSchema>;

export type AnalyseJobRequestErrorCode =
  | 'INVALID_REQUEST'
  | 'EMPTY_JOB_AD'
  | 'JOB_AD_TOO_LONG';

export class AnalyseJobRequestValidationError extends Error {
  readonly code: AnalyseJobRequestErrorCode;

  constructor(code: AnalyseJobRequestErrorCode, message: string) {
    super(message);
    this.name = 'AnalyseJobRequestValidationError';
    this.code = code;
  }
}

export function parseAnalyseJobRequest(input: unknown): AnalyseJobRequest {
  const parsed = analyseJobRequestSchema.safeParse(input);

  if (parsed.success) {
    return parsed.data;
  }

  const jobAdIssue = parsed.error.issues.find(
    (issue) => issue.path.length === 1 && issue.path[0] === 'jobAd',
  );

  if (
    jobAdIssue?.code === 'too_big' ||
    (typeof input === 'object' &&
      input !== null &&
      'jobAd' in input &&
      typeof input.jobAd === 'string' &&
      input.jobAd.length > JOB_AD_MAX_CHARACTERS)
  ) {
    throw new AnalyseJobRequestValidationError(
      'JOB_AD_TOO_LONG',
      `Job advertisements cannot exceed ${JOB_AD_MAX_CHARACTERS.toLocaleString('en-AU')} characters.`,
    );
  }

  if (
    typeof input === 'object' &&
    input !== null &&
    'jobAd' in input &&
    typeof input.jobAd === 'string' &&
    input.jobAd.trim().length === 0
  ) {
    throw new AnalyseJobRequestValidationError(
      'EMPTY_JOB_AD',
      'Paste a job advertisement before analysing it.',
    );
  }

  throw new AnalyseJobRequestValidationError(
    'INVALID_REQUEST',
    'The analysis request is invalid.',
  );
}

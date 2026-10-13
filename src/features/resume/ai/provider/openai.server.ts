import OpenAI, {
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ZodError } from 'zod';
import type {
  AnalyseJobProviderInput,
  JobAnalysisProvider,
} from '../job-analysis/analyse-job';
import { jobAnalysisV1Schema } from '../job-analysis/schema';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 4_096;

export type OpenAIJobAnalysisProviderErrorKind =
  | 'rate-limited'
  | 'invalid-response'
  | 'timeout'
  | 'unavailable';

export class OpenAIJobAnalysisProviderError extends Error {
  readonly kind: OpenAIJobAnalysisProviderErrorKind;

  constructor(kind: OpenAIJobAnalysisProviderErrorKind) {
    super('The job-analysis provider could not complete the request.');
    this.name = 'OpenAIJobAnalysisProviderError';
    this.kind = kind;
  }
}

export interface OpenAIJobAnalysisProviderOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

/**
 * Creates the only OpenAI-specific implementation of the provider-neutral
 * JobAnalysisProvider contract. This module must only be imported server-side.
 */
export function createOpenAIJobAnalysisProvider(
  options: OpenAIJobAnalysisProviderOptions,
): JobAnalysisProvider {
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || DEFAULT_OPENAI_MODEL;
  const timeoutMs = Math.min(
    Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_000),
    60_000,
  );
  const client = apiKey.length > 0
    ? new OpenAI({
        apiKey,
        timeout: timeoutMs,
        maxRetries: 0,
        logLevel: 'off',
        ...(options.fetchImplementation === undefined
          ? {}
          : { fetch: options.fetchImplementation }),
      })
    : null;

  return {
    async analyse(input: AnalyseJobProviderInput): Promise<unknown> {
      if (client === null) {
        throw new OpenAIJobAnalysisProviderError('unavailable');
      }

      try {
        const response = await client.responses.parse(
          {
            model,
            instructions: input.prompt.system,
            input: input.prompt.user,
            temperature: 0,
            max_output_tokens: MAX_OUTPUT_TOKENS,
            store: false,
            text: {
              format: zodTextFormat(
                jobAnalysisV1Schema,
                'arrivly_job_analysis_v1',
              ),
            },
          },
          { signal: input.signal },
        );

        // Refusals and incomplete responses do not contain parsed output. The
        // provider-neutral domain layer will run its grounding checks again.
        if (
          response.status !== 'completed' ||
          response.output_parsed === null
        ) {
          throw new OpenAIJobAnalysisProviderError('invalid-response');
        }

        return response.output_parsed;
      } catch (error) {
        if (error instanceof OpenAIJobAnalysisProviderError) {
          throw error;
        }

        if (
          error instanceof RateLimitError ||
          (error instanceof APIError && error.status === 429)
        ) {
          throw new OpenAIJobAnalysisProviderError('rate-limited');
        }

        if (error instanceof APIConnectionTimeoutError) {
          throw new OpenAIJobAnalysisProviderError('timeout');
        }

        if (error instanceof ZodError || error instanceof SyntaxError) {
          throw new OpenAIJobAnalysisProviderError('invalid-response');
        }

        if (error instanceof APIError) {
          throw new OpenAIJobAnalysisProviderError('unavailable');
        }

        // Non-API errors at this point came from parsing the structured SDK
        // response. Collapse them without exposing parser or response details.
        throw new OpenAIJobAnalysisProviderError('invalid-response');
      }
    },
  };
}

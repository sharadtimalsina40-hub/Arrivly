import OpenAI, {
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ZodError } from 'zod';
import type {
  GenerateResumeWritingProviderInput,
  ResumeWritingProvider,
} from './generate';
import { generatedResumeProposalSchema } from './schema';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 6_000;

export type OpenAIResumeWritingProviderErrorKind =
  | 'rate-limited'
  | 'invalid-response'
  | 'timeout'
  | 'unavailable';

export class OpenAIResumeWritingProviderError extends Error {
  readonly kind: OpenAIResumeWritingProviderErrorKind;

  constructor(kind: OpenAIResumeWritingProviderErrorKind) {
    super('The resume-writing provider could not complete the request.');
    this.name = 'OpenAIResumeWritingProviderError';
    this.kind = kind;
  }
}

export interface OpenAIResumeWritingProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

/** Server-only OpenAI adapter. Candidate content is never logged or stored. */
export function createOpenAIResumeWritingProvider(
  options: OpenAIResumeWritingProviderOptions,
): ResumeWritingProvider {
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
    async generate(input: GenerateResumeWritingProviderInput): Promise<unknown> {
      if (client === null) {
        throw new OpenAIResumeWritingProviderError('unavailable');
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
                generatedResumeProposalSchema,
                'arrivly_resume_proposal_v1',
              ),
            },
          },
          { signal: input.signal },
        );

        // Refusals and incomplete responses contain no parsed proposal. The
        // deterministic grounding layer still validates every returned claim.
        if (
          response.status !== 'completed' ||
          response.output_parsed === null
        ) {
          throw new OpenAIResumeWritingProviderError('invalid-response');
        }

        return response.output_parsed;
      } catch (error) {
        if (error instanceof OpenAIResumeWritingProviderError) {
          throw error;
        }

        if (
          error instanceof RateLimitError ||
          (error instanceof APIError && error.status === 429)
        ) {
          throw new OpenAIResumeWritingProviderError('rate-limited');
        }

        if (error instanceof APIConnectionTimeoutError) {
          throw new OpenAIResumeWritingProviderError('timeout');
        }

        if (error instanceof ZodError || error instanceof SyntaxError) {
          throw new OpenAIResumeWritingProviderError('invalid-response');
        }

        if (error instanceof APIError) {
          throw new OpenAIResumeWritingProviderError('unavailable');
        }

        // Any remaining SDK parsing failure is deliberately collapsed without
        // exposing candidate data, provider details or stack traces.
        throw new OpenAIResumeWritingProviderError('invalid-response');
      }
    },
  };
}

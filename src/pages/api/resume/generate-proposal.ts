import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import {
  generateEvidenceGroundedResumeProposal,
  ResumeWritingEmptyEvidenceError,
} from '../../../features/resume/ai/resume-writing/generate';
import {
  createOpenAIResumeWritingProvider,
  OpenAIResumeWritingProviderError,
} from '../../../features/resume/ai/resume-writing/openai.server';
import {
  ResumeWritingValidationError,
  parseResumeWritingInput,
} from '../../../features/resume/ai/resume-writing/schema';
import type { ResumeWritingInput } from '../../../features/resume/ai/resume-writing/types';

export const prerender = false;

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

type ResumeProposalApiErrorCode =
  | 'INVALID_REQUEST'
  | 'REQUEST_NOT_ALLOWED'
  | 'REQUEST_TOO_LARGE'
  | 'EMPTY_EVIDENCE'
  | 'RATE_LIMITED'
  | 'INVALID_AI_RESPONSE'
  | 'GENERATION_FAILED'
  | 'SERVICE_UNAVAILABLE';

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

class RequestBodyTooLargeError extends Error {}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function errorResponse(
  status: number,
  code: ResumeProposalApiErrorCode,
  message: string,
): Response {
  return jsonResponse({ success: false, error: { code, message } }, status);
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin === null) {
    return true;
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function hasJsonContentType(request: Request): boolean {
  return (
    request.headers
      .get('Content-Type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase() === 'application/json'
  );
}

async function readLimitedBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }
  if (request.body === null) {
    return '';
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function runtimeConfig(): {
  apiKey?: string;
  model?: string;
  rateLimiter?: RateLimitBinding;
} {
  const runtimeEnv = env as unknown as {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    JOB_ANALYSIS_RATE_LIMITER?: RateLimitBinding;
  };
  return {
    apiKey: runtimeEnv.OPENAI_API_KEY,
    model: runtimeEnv.OPENAI_MODEL,
    rateLimiter: runtimeEnv.JOB_ANALYSIS_RATE_LIMITER,
  };
}

async function exceedsRateLimit(
  request: Request,
  rateLimiter: RateLimitBinding,
): Promise<boolean> {
  const requester =
    request.headers.get('CF-Connecting-IP')?.trim() || 'local-development';
  try {
    const result = await rateLimiter.limit({
      key: `resume-writing:${requester}`,
    });
    return !result.success;
  } catch {
    return true;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return errorResponse(403, 'REQUEST_NOT_ALLOWED', 'This request is not allowed.');
  }
  if (!hasJsonContentType(request)) {
    return errorResponse(400, 'INVALID_REQUEST', 'Send resume evidence as JSON.');
  }

  let untrustedBody: unknown;
  try {
    untrustedBody = JSON.parse(await readLimitedBody(request)) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return errorResponse(
        413,
        'REQUEST_TOO_LARGE',
        'There is too much resume content to tailor in one request.',
      );
    }
    return errorResponse(400, 'INVALID_REQUEST', 'Send valid resume evidence.');
  }

  let input: ResumeWritingInput;
  try {
    input = parseResumeWritingInput(untrustedBody);
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', 'Send valid resume evidence.');
  }

  if (
    input.candidateEvidence.length === 0 &&
    input.confirmedFollowUpEvidence.length === 0
  ) {
    return errorResponse(
      400,
      'EMPTY_EVIDENCE',
      'Add or confirm some resume details before generating suggestions.',
    );
  }

  const { apiKey, model, rateLimiter } = runtimeConfig();
  if (!apiKey?.trim() || !rateLimiter) {
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      'Resume suggestions are temporarily unavailable. Please try again later.',
    );
  }
  if (await exceedsRateLimit(request, rateLimiter)) {
    return errorResponse(
      429,
      'RATE_LIMITED',
      'Resume suggestions are busy. Please wait a moment and try again.',
    );
  }

  const provider = createOpenAIResumeWritingProvider({
    apiKey,
    ...(model?.trim() ? { model: model.trim() } : {}),
  });

  try {
    const result = await generateEvidenceGroundedResumeProposal(
      input,
      provider,
      { signal: request.signal },
    );
    return jsonResponse({ success: true, ...result }, 200);
  } catch (error) {
    if (error instanceof ResumeWritingEmptyEvidenceError) {
      return errorResponse(400, 'EMPTY_EVIDENCE', error.message);
    }
    if (error instanceof ResumeWritingValidationError) {
      return errorResponse(
        502,
        'INVALID_AI_RESPONSE',
        'The writing service returned an unsafe response. No suggestions were applied.',
      );
    }

    if (error instanceof OpenAIResumeWritingProviderError) {
      if (error.kind === 'rate-limited') {
        return errorResponse(
          429,
          'RATE_LIMITED',
          'Resume suggestions are busy. Please wait a moment and try again.',
        );
      }

      if (error.kind === 'invalid-response') {
        return errorResponse(
          502,
          'INVALID_AI_RESPONSE',
          'The writing service returned an unsafe response. No suggestions were applied.',
        );
      }

      return errorResponse(
        503,
        'SERVICE_UNAVAILABLE',
        'Resume suggestions are temporarily unavailable. Please try again later.',
      );
    }

    return errorResponse(
      502,
      'GENERATION_FAILED',
      'We couldn’t create resume suggestions. Please try again.',
    );
  }
};

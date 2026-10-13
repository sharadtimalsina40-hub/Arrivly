import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import {
  analyseJobAdvertisement,
} from '../../../features/resume/ai/job-analysis/analyse-job';
import {
  JOB_AD_MAX_CHARACTERS,
  AnalyseJobRequestValidationError,
  parseAnalyseJobRequest,
} from '../../../features/resume/ai/job-analysis/request';
import { JobAnalysisValidationError } from '../../../features/resume/ai/job-analysis/schema';
import {
  OpenAIJobAnalysisProviderError,
  createOpenAIJobAnalysisProvider,
} from '../../../features/resume/ai/provider/openai.server';

export const prerender = false;

// A 20,000-character Unicode string plus JSON escaping can exceed 64 KiB.
// This byte cap still bounds transport memory while leaving the character cap
// in the domain request schema as the AI-cost limit.
const MAX_REQUEST_BODY_BYTES = 128 * 1024;

type AnalyseJobApiErrorCode =
  | 'INVALID_REQUEST'
  | 'REQUEST_NOT_ALLOWED'
  | 'JOB_AD_TOO_LONG'
  | 'RATE_LIMITED'
  | 'INVALID_AI_RESPONSE'
  | 'ANALYSIS_FAILED'
  | 'SERVICE_UNAVAILABLE';

interface AnalyseJobApiErrorResponse {
  success: false;
  error: {
    code: AnalyseJobApiErrorCode;
    message: string;
  };
}

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
  code: AnalyseJobApiErrorCode,
  message: string,
): Response {
  const body: AnalyseJobApiErrorResponse = {
    success: false,
    error: { code, message },
  };

  return jsonResponse(body, status);
}

function isSameOriginRequest(request: Request): boolean {
  const originHeader = request.headers.get('Origin');

  // Some non-browser clients omit Origin. Browsers send it for this JSON POST,
  // so reject only when an explicit, different origin is supplied.
  if (originHeader === null) {
    return true;
  }

  try {
    return new URL(originHeader).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get('Content-Type');

  return contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

async function readLimitedBody(request: Request): Promise<string> {
  const declaredLength = request.headers.get('Content-Length');

  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);

    if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (request.body === null) {
    return '';
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    byteLength += value.byteLength;

    if (byteLength > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }

    chunks.push(value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

function getRuntimeConfig(): {
  apiKey: string | undefined;
  model: string | undefined;
  rateLimiter: RateLimitBinding | undefined;
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

async function exceedsAnalysisRateLimit(
  request: Request,
  rateLimiter: RateLimitBinding,
): Promise<boolean> {
  // Cloudflare supplies this header in production. The fallback keeps local
  // development deterministic without recording or returning an IP address.
  const requesterKey =
    request.headers.get('CF-Connecting-IP')?.trim() || 'local-development';

  try {
    const result = await rateLimiter.limit({
      key: `resume-job-analysis:${requesterKey}`,
    });

    return !result.success;
  } catch {
    // Fail closed if the cost-control binding is temporarily unavailable.
    return true;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return errorResponse(
      403,
      'REQUEST_NOT_ALLOWED',
      'This request is not allowed.',
    );
  }

  if (!hasJsonContentType(request)) {
    return errorResponse(
      400,
      'INVALID_REQUEST',
      'Send the job advertisement as JSON.',
    );
  }

  let untrustedBody: unknown;

  try {
    const bodyText = await readLimitedBody(request);
    untrustedBody = JSON.parse(bodyText) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return errorResponse(
        413,
        'JOB_AD_TOO_LONG',
        `Job advertisements can be up to ${JOB_AD_MAX_CHARACTERS.toLocaleString('en-AU')} characters.`,
      );
    }

    return errorResponse(
      400,
      'INVALID_REQUEST',
      'Send a valid job advertisement.',
    );
  }

  if (
    typeof untrustedBody === 'object' &&
    untrustedBody !== null &&
    'jobAd' in untrustedBody &&
    typeof untrustedBody.jobAd === 'string' &&
    untrustedBody.jobAd.length > JOB_AD_MAX_CHARACTERS
  ) {
    return errorResponse(
      413,
      'JOB_AD_TOO_LONG',
      `Job advertisements can be up to ${JOB_AD_MAX_CHARACTERS.toLocaleString('en-AU')} characters.`,
    );
  }

  let jobAd: string;

  try {
    ({ jobAd } = parseAnalyseJobRequest(untrustedBody));
  } catch (error) {
    if (error instanceof AnalyseJobRequestValidationError) {
      if (error.code === 'JOB_AD_TOO_LONG') {
        return errorResponse(
          413,
          'JOB_AD_TOO_LONG',
          `Job advertisements can be up to ${JOB_AD_MAX_CHARACTERS.toLocaleString('en-AU')} characters.`,
        );
      }

      return errorResponse(
        400,
        'INVALID_REQUEST',
        error.code === 'EMPTY_JOB_AD'
          ? 'Enter a job advertisement before analysing it.'
          : 'Send a valid job advertisement.',
      );
    }

    return errorResponse(
      400,
      'INVALID_REQUEST',
      'Send a valid job advertisement.',
    );
  }

  const { apiKey, model, rateLimiter } = getRuntimeConfig();

  if (
    typeof apiKey !== 'string' ||
    apiKey.trim().length === 0 ||
    rateLimiter === undefined
  ) {
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      'Job analysis is temporarily unavailable. Please try again later.',
    );
  }

  if (await exceedsAnalysisRateLimit(request, rateLimiter)) {
    return errorResponse(
      429,
      'RATE_LIMITED',
      'Job analysis is busy. Please wait a moment and try again.',
    );
  }

  const provider = createOpenAIJobAnalysisProvider({
    apiKey,
    ...(typeof model === 'string' && model.trim().length > 0
      ? { model: model.trim() }
      : {}),
  });

  try {
    const analysis = await analyseJobAdvertisement(jobAd, provider, {
      signal: request.signal,
    });

    return jsonResponse({ success: true, analysis }, 200);
  } catch (error) {
    if (import.meta.env.DEV) {
  console.error("[job-analysis-debug]", {
    errorType: error?.constructor?.name,
    providerKind:
      error instanceof OpenAIJobAnalysisProviderError
        ? error.kind
        : undefined,
    message: error instanceof Error ? error.message : String(error),
  });
}
    if (error instanceof JobAnalysisValidationError) {
      return errorResponse(
        502,
        'INVALID_AI_RESPONSE',
        'The job analysis could not be verified. Please try again.',
      );
    }

    if (error instanceof OpenAIJobAnalysisProviderError) {
      if (error.kind === 'rate-limited') {
        return errorResponse(
          429,
          'RATE_LIMITED',
          'Job analysis is busy. Please wait a moment and try again.',
        );
      }

      if (error.kind === 'invalid-response') {
        return errorResponse(
          502,
          'INVALID_AI_RESPONSE',
          'The job analysis could not be verified. Please try again.',
        );
      }

      if (error.kind === 'timeout') {
        return errorResponse(
          504,
          'ANALYSIS_FAILED',
          'Job analysis took too long. Please try again.',
        );
      }
    }

    return errorResponse(
      502,
      'ANALYSIS_FAILED',
      'We could not analyse this job advertisement right now. Please try again.',
    );
  }
};

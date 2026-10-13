import type { JobAnalysisV1 } from './types';
import type { JobAnalysisPrompt } from './prompt';
import { buildJobAnalysisPrompt } from './prompt';
import { parseAnalyseJobRequest } from './request';
import { parseJobAnalysis } from './schema';

export interface AnalyseJobProviderInput {
  prompt: JobAnalysisPrompt;
  signal?: AbortSignal;
}

/**
 * Provider-neutral boundary. Implementations may call OpenAI or another
 * provider, but must return a parsed JavaScript value rather than trusting it.
 */
export interface JobAnalysisProvider {
  analyse(input: AnalyseJobProviderInput): Promise<unknown>;
}

export interface AnalyseJobAdvertisementOptions {
  signal?: AbortSignal;
}

/**
 * Coordinates validated input, prompt construction, provider execution and
 * strict output/grounding validation without reading or changing resume state.
 */
export async function analyseJobAdvertisement(
  jobAdText: string,
  provider: JobAnalysisProvider,
  options: AnalyseJobAdvertisementOptions = {},
): Promise<JobAnalysisV1> {
  const { jobAd } = parseAnalyseJobRequest({ jobAd: jobAdText });
  const rawAnalysis = await provider.analyse({
    prompt: buildJobAnalysisPrompt(jobAd),
    signal: options.signal,
  });

  return parseJobAnalysis(rawAnalysis, jobAd);
}

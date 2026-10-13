import assert from 'node:assert/strict';
import test from 'node:test';
import { Packer } from 'docx';
import JSZip from 'jszip';
import type { JobAnalysisV1 } from '../../src/features/resume/ai/job-analysis/types';
import {
  generateEvidenceGroundedResumeProposal,
  ResumeWritingEmptyEvidenceError,
} from '../../src/features/resume/ai/resume-writing/generate';
import { validateGeneratedResumeProposal } from '../../src/features/resume/ai/resume-writing/grounding';
import { buildResumeWritingPrompt } from '../../src/features/resume/ai/resume-writing/prompt';
import {
  createOpenAIResumeWritingProvider,
  OpenAIResumeWritingProviderError,
} from '../../src/features/resume/ai/resume-writing/openai.server';
import {
  allResumeWritingSuggestionIds,
  createInitialResumeWritingReviewState,
  experienceSuggestionId,
  resumeWritingReviewReducer,
  skillSuggestionId,
  summarySuggestionId,
} from '../../src/features/resume/ai/resume-writing/review';
import { buildTailoredResumeViewModel } from '../../src/features/resume/ai/resume-writing/tailored-resume';
import { ResumeWritingValidationError } from '../../src/features/resume/ai/resume-writing/schema';
import type {
  GeneratedResumeProposal,
  ResumeWritingEvidence,
  ResumeWritingInput,
} from '../../src/features/resume/ai/resume-writing/types';
import { buildNormalizedTerms } from '../../src/features/resume/matching/normalize';
import { resumeDocxTemplates } from '../../src/features/resume/docx/registry';
import type { ResumeViewModel } from '../../src/features/resume/model/preview-model';
import type { TemplateId } from '../../src/features/resume/model/types';
import { resumePdfTemplates } from '../../src/features/resume/pdf/registry';

function emptyAnalysis(
  overrides: Partial<JobAnalysisV1> = {},
): JobAnalysisV1 {
  return {
    schemaVersion: 1,
    jobTitle: null,
    employer: null,
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: [],
    qualifications: [],
    certifications: [],
    softSkills: [],
    keywords: [],
    experienceRequirements: [],
    otherRequirements: [],
    ...overrides,
  };
}

function evidence(
  id: string,
  text: string,
  overrides: Partial<ResumeWritingEvidence> = {},
): ResumeWritingEvidence {
  return {
    id,
    source: 'skill',
    sourceId: id,
    parentSourceId: null,
    text,
    normalizedTerms: buildNormalizedTerms(text),
    evidenceClass: 'skill',
    strength: 'direct',
    confirmed: true,
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<ResumeWritingInput> = {},
): ResumeWritingInput {
  return {
    analysis: emptyAnalysis(),
    resume: {
      targetJobTitle: 'Software Developer',
      experience: [],
      education: [],
      skills: [],
      licences: [],
    },
    candidateEvidence: [],
    confirmedFollowUpEvidence: [],
    ...overrides,
  };
}

function proposal(
  overrides: Partial<GeneratedResumeProposal> = {},
): GeneratedResumeProposal {
  return {
    schemaVersion: 1,
    summary: null,
    experience: [],
    suggestedSkills: [],
    ...overrides,
  };
}

test('software proposal uses supported technologies and withholds AWS', () => {
  const input = baseInput({
    analysis: emptyAnalysis({
      requiredSkills: [
        { name: 'TypeScript', evidenceText: 'TypeScript is required' },
        { name: 'Node.js', evidenceText: 'Node.js is required' },
        { name: 'PostgreSQL', evidenceText: 'PostgreSQL is required' },
        { name: 'AWS', evidenceText: 'AWS is required' },
      ],
    }),
    resume: {
      targetJobTitle: 'Software Developer',
      experience: [
        {
          id: 'exp-1',
          roleTitle: 'Developer',
          description: null,
          highlights: [
            {
              sourceFactId: 'fact-backend',
              text: 'Built backend APIs using Node.js and PostgreSQL.',
            },
          ],
        },
      ],
      education: [],
      skills: [
        { id: 'ts', name: 'TypeScript' },
        { id: 'node', name: 'Node.js' },
        { id: 'postgres', name: 'PostgreSQL' },
      ],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-ts', 'TypeScript', { sourceId: 'ts' }),
      evidence('e-node', 'Node.js', { sourceId: 'node' }),
      evidence('e-postgres', 'PostgreSQL', { sourceId: 'postgres' }),
      evidence(
        'e-backend',
        'Built backend APIs using Node.js and PostgreSQL.',
        {
          source: 'experience-highlight',
          sourceId: 'fact-backend',
          parentSourceId: 'exp-1',
          evidenceClass: 'responsibility',
        },
      ),
    ],
  });

  const result = validateGeneratedResumeProposal(
    proposal({
      summary: {
        text: 'Technical skills include TypeScript, Node.js and PostgreSQL.',
        sourceRefs: ['e-ts', 'e-node', 'e-postgres'],
      },
      experience: [
        {
          experienceId: 'exp-1',
          bullets: [
            {
              text: 'Built backend APIs using Node.js and PostgreSQL.',
              sourceRefs: ['e-backend'],
            },
          ],
        },
      ],
      suggestedSkills: [
        { text: 'TypeScript', sourceRefs: ['e-ts'] },
        { text: 'AWS', sourceRefs: ['e-node'] },
      ],
    }),
    input,
  );

  assert.equal(result.proposal.summary?.text.includes('AWS'), false);
  assert.deepEqual(
    result.proposal.suggestedSkills.map((item) => item.text),
    ['TypeScript'],
  );
  assert.equal(result.proposal.experience[0]?.bullets.length, 1);
  assert.equal(result.rejectedStatements, 1);
  const evidenceIds = new Set(input.candidateEvidence.map((item) => item.id));
  for (const statement of [
    result.proposal.summary,
    ...result.proposal.experience.flatMap((item) => item.bullets),
    ...result.proposal.suggestedSkills,
  ].filter((item): item is NonNullable<typeof item> => item !== null)) {
    assert.ok(statement.sourceRefs.every((ref) => evidenceIds.has(ref)));
  }
});

test('cafe wording may paraphrase facts but fake metrics and Australian experience are withheld', () => {
  const groceryEvidence = evidence(
    'e-grocery',
    'Helped customers and put stock on shelves.',
    {
      source: 'experience-highlight',
      sourceId: 'fact-grocery',
      parentSourceId: 'exp-grocery',
      evidenceClass: 'responsibility',
    },
  );
  const input = baseInput({
    analysis: emptyAnalysis({
      requiredSkills: [
        { name: 'Customer service', evidenceText: 'Customer service required' },
      ],
    }),
    resume: {
      targetJobTitle: 'Cafe All-rounder',
      experience: [
        {
          id: 'exp-grocery',
          roleTitle: 'Family grocery store helper',
          description: 'Helped customers and put stock on shelves.',
          highlights: [
            {
              sourceFactId: 'fact-grocery',
              text: 'Helped customers and put stock on shelves.',
            },
          ],
        },
      ],
      education: [],
      skills: [],
      licences: [],
    },
    candidateEvidence: [groceryEvidence],
  });

  const result = validateGeneratedResumeProposal(
    proposal({
      experience: [
        {
          experienceId: 'exp-grocery',
          bullets: [
            {
              text: 'Assisted customers with product enquiries and replenished stock to maintain organised displays.',
              sourceRefs: ['e-grocery'],
            },
            {
              text: 'Increased sales by 35% through exceptional customer service.',
              sourceRefs: ['e-grocery'],
            },
            {
              text: 'Applied Australian experience in customer service.',
              sourceRefs: ['e-grocery'],
            },
          ],
        },
      ],
    }),
    input,
  );

  assert.deepEqual(
    result.proposal.experience[0]?.bullets.map((item) => item.text),
    [
      'Assisted customers with product enquiries and replenished stock to maintain organised displays.',
    ],
  );
  assert.equal(result.rejectedStatements, 2);
});

test('rejects missing refs structurally, unknown refs, wrong experience and unsupported credentials', () => {
  const input = baseInput({
    resume: {
      targetJobTitle: null,
      experience: [
        {
          id: 'exp-1',
          roleTitle: 'Developer',
          description: null,
          highlights: [{ sourceFactId: 'fact', text: 'Built APIs' }],
        },
        { id: 'exp-2', roleTitle: 'Assistant', description: null, highlights: [] },
      ],
      education: [],
      skills: [{ id: 'aws', name: 'AWS' }],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-aws', 'AWS', { sourceId: 'aws' }),
      evidence('e-exp', 'Built APIs', {
        source: 'experience-highlight',
        sourceId: 'fact',
        parentSourceId: 'exp-1',
        evidenceClass: 'responsibility',
      }),
    ],
  });

  assert.throws(
    () =>
      validateGeneratedResumeProposal(
        proposal({
          summary: { text: 'AWS', sourceRefs: [] },
        }),
        input,
      ),
    ResumeWritingValidationError,
  );

  const result = validateGeneratedResumeProposal(
    proposal({
      summary: { text: 'AWS', sourceRefs: ['missing'] },
      experience: [
        {
          experienceId: 'exp-2',
          bullets: [{ text: 'Built APIs', sourceRefs: ['e-exp'] }],
        },
      ],
      suggestedSkills: [
        { text: 'AWS Certified Developer', sourceRefs: ['e-aws'] },
      ],
    }),
    input,
  );

  assert.equal(result.proposal.summary, null);
  assert.deepEqual(result.proposal.experience, []);
  assert.deepEqual(result.proposal.suggestedSkills, []);
  assert.equal(result.rejectedStatements, 3);
});

test('a negative narrative mention cannot be rewritten as a positive skill claim', () => {
  const input = baseInput({
    analysis: emptyAnalysis({
      requiredSkills: [{ name: 'AWS', evidenceText: 'AWS is required' }],
    }),
    resume: {
      targetJobTitle: 'Software Developer',
      experience: [
        {
          id: 'exp-1',
          roleTitle: 'Developer',
          description: null,
          highlights: [
            {
              sourceFactId: 'negative-aws',
              text: 'I have no AWS experience.',
            },
          ],
        },
      ],
      education: [],
      skills: [],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-negative-aws', 'I have no AWS experience.', {
        source: 'experience-highlight',
        sourceId: 'negative-aws',
        parentSourceId: 'exp-1',
        evidenceClass: 'responsibility',
      }),
    ],
  });

  const result = validateGeneratedResumeProposal(
    proposal({
      summary: { text: 'AWS experience', sourceRefs: ['e-negative-aws'] },
    }),
    input,
  );

  assert.equal(result.proposal.summary, null);
  assert.equal(result.rejectedStatements, 1);
});

test('professional wording cannot invent a new action merely because it is a resume verb', () => {
  const apiEvidence = evidence('e-api', 'Built APIs', {
    source: 'experience-highlight',
    sourceId: 'fact-api',
    parentSourceId: 'exp-1',
    evidenceClass: 'responsibility',
  });
  const input = baseInput({
    resume: {
      targetJobTitle: 'Developer',
      experience: [
        {
          id: 'exp-1',
          roleTitle: 'Developer',
          description: null,
          highlights: [{ sourceFactId: 'fact-api', text: 'Built APIs' }],
        },
      ],
      education: [],
      skills: [],
      licences: [],
    },
    candidateEvidence: [apiEvidence],
  });

  const result = validateGeneratedResumeProposal(
    proposal({
      experience: [
        {
          experienceId: 'exp-1',
          bullets: [
            { text: 'Developed APIs', sourceRefs: ['e-api'] },
            { text: 'Designed and deployed APIs', sourceRefs: ['e-api'] },
          ],
        },
      ],
    }),
    input,
  );

  assert.deepEqual(
    result.proposal.experience[0]?.bullets.map((item) => item.text),
    ['Developed APIs'],
  );
  assert.equal(result.rejectedStatements, 1);
});

test('server canonicalisation ignores forged normalized terms and evidence class', () => {
  const input = baseInput({
    analysis: emptyAnalysis({
      requiredSkills: [{ name: 'AWS', evidenceText: 'AWS required' }],
    }),
    resume: {
      targetJobTitle: 'Developer',
      experience: [],
      education: [],
      skills: [{ id: 'skill-ts', name: 'TypeScript' }],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-ts', 'TypeScript', {
        sourceId: 'skill-ts',
        normalizedTerms: ['aws'],
        evidenceClass: 'certification',
      }),
    ],
  });

  const result = validateGeneratedResumeProposal(
    proposal({
      suggestedSkills: [{ text: 'AWS', sourceRefs: ['e-ts'] }],
    }),
    input,
  );

  assert.deepEqual(result.proposal.suggestedSkills, []);
  assert.equal(result.rejectedStatements, 1);
});

test('facts from different sources cannot be recombined into a new action-object claim', () => {
  const input = baseInput({
    resume: {
      targetJobTitle: 'Developer',
      experience: [
        {
          id: 'exp-1',
          roleTitle: 'Developer',
          description: null,
          highlights: [
            { sourceFactId: 'api', text: 'Built APIs' },
            { sourceFactId: 'web', text: 'Deployed websites' },
          ],
        },
      ],
      education: [],
      skills: [],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-api', 'Built APIs', {
        source: 'experience-highlight',
        sourceId: 'api',
        parentSourceId: 'exp-1',
        evidenceClass: 'responsibility',
      }),
      evidence('e-web', 'Deployed websites', {
        source: 'experience-highlight',
        sourceId: 'web',
        parentSourceId: 'exp-1',
        evidenceClass: 'responsibility',
      }),
    ],
  });

  const result = validateGeneratedResumeProposal(
    proposal({
      experience: [
        {
          experienceId: 'exp-1',
          bullets: [
            {
              text: 'Deployed APIs',
              sourceRefs: ['e-api', 'e-web'],
            },
          ],
        },
      ],
    }),
    input,
  );

  assert.deepEqual(result.proposal.experience, []);
  assert.equal(result.rejectedStatements, 1);
});

test('actions and objects cannot be recombined even when they occur in one source sentence', () => {
  const source = 'Built APIs and deployed websites';
  const input = baseInput({
    resume: {
      targetJobTitle: 'Developer',
      experience: [
        {
          id: 'exp-1',
          roleTitle: 'Developer',
          description: null,
          highlights: [{ sourceFactId: 'mixed', text: source }],
        },
      ],
      education: [],
      skills: [],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-mixed', source, {
        source: 'experience-highlight',
        sourceId: 'mixed',
        parentSourceId: 'exp-1',
        evidenceClass: 'responsibility',
      }),
    ],
  });

  const result = validateGeneratedResumeProposal(
    proposal({
      experience: [
        {
          experienceId: 'exp-1',
          bullets: [
            { text: 'Deployed APIs', sourceRefs: ['e-mixed'] },
          ],
        },
      ],
    }),
    input,
  );

  assert.deepEqual(result.proposal.experience, []);
  assert.equal(result.rejectedStatements, 1);
});

test('numbers and their subjects must be grounded by the same evidence source', () => {
  const input = baseInput({
    resume: {
      targetJobTitle: 'Cloud Engineer',
      experience: [],
      education: [],
      skills: [
        { id: 'service', name: '5 years customer service experience' },
        { id: 'aws', name: 'AWS' },
      ],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-duration', '5 years customer service experience', {
        sourceId: 'service',
      }),
      evidence('e-aws', 'AWS', { sourceId: 'aws' }),
    ],
  });

  const result = validateGeneratedResumeProposal(
    proposal({
      summary: {
        text: '5 years AWS experience',
        sourceRefs: ['e-duration', 'e-aws'],
      },
    }),
    input,
  );

  assert.equal(result.proposal.summary, null);
  assert.equal(result.rejectedStatements, 1);
});

test('confirmed follow-up claims must correspond to the analysed job', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'AWS', evidenceText: 'AWS required' }],
  });
  const confirmedAws = evidence(
    'follow-up-aws',
    'Confirmed follow-up — Have you used AWS?: Yes',
    {
      source: 'follow-up',
      sourceId: 'answer-aws',
      normalizedTerms: ['forged-value-is-ignored'],
      evidenceClass: 'general',
    },
  );
  const input = baseInput({
    analysis,
    confirmedFollowUpEvidence: [confirmedAws],
  });

  const accepted = validateGeneratedResumeProposal(
    proposal({
      suggestedSkills: [
        { text: 'AWS', sourceRefs: ['follow-up-aws'] },
      ],
    }),
    input,
  );
  assert.deepEqual(
    accepted.proposal.suggestedSkills.map((item) => item.text),
    ['AWS'],
  );

  assert.throws(
    () =>
      validateGeneratedResumeProposal(
        proposal(),
        baseInput({
          analysis: emptyAnalysis({
            requiredSkills: [
              { name: 'TypeScript', evidenceText: 'TypeScript required' },
            ],
          }),
          confirmedFollowUpEvidence: [confirmedAws],
        }),
      ),
    ResumeWritingValidationError,
  );
});

test('uses one provider call and handles candidates with little or no evidence', async () => {
  const minimalInput = baseInput({
    resume: {
      targetJobTitle: null,
      experience: [],
      education: [],
      skills: [{ id: 'service', name: 'Customer service' }],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-service', 'Customer service', { sourceId: 'service' }),
    ],
  });
  let calls = 0;
  const result = await generateEvidenceGroundedResumeProposal(
    minimalInput,
    {
      async generate() {
        calls += 1;
        return proposal();
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.proposal.summary, null);

  let emptyCalls = 0;
  await assert.rejects(
    generateEvidenceGroundedResumeProposal(baseInput(), {
      async generate() {
        emptyCalls += 1;
        return proposal();
      },
    }),
    ResumeWritingEmptyEvidenceError,
  );
  assert.equal(emptyCalls, 0);
});

test('prompt treats job analysis as context and requires evidence refs', () => {
  const input = baseInput({
    analysis: emptyAnalysis({
      requiredSkills: [{ name: 'AWS', evidenceText: 'AWS required' }],
    }),
    resume: {
      targetJobTitle: 'Software Developer',
      experience: [],
      education: [],
      skills: [{ id: 'ts', name: 'TypeScript' }],
      licences: [],
    },
    candidateEvidence: [evidence('e-ts', 'TypeScript', { sourceId: 'ts' })],
  });
  const built = buildResumeWritingPrompt(input);
  assert.match(built.system, /Job analysis is employer context only/);
  assert.match(built.system, /Every summary, bullet and suggested skill/);
  assert.match(built.user, /e-ts/);
  assert.match(built.user, /AWS/);
  assert.doesNotMatch(built.user, /"resume":/);
});

test('OpenAI adapter requests strict, low-creativity, non-stored structured output', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  let requestBody: Record<string, unknown> | undefined;
  const provider = createOpenAIResumeWritingProvider({
    apiKey: 'test-key',
    fetchImplementation: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify(proposal()),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  const generated = await provider.generate({
    prompt: { system: 'system', user: 'user' },
  });

  assert.deepEqual(generated, proposal());
  assert.equal(requestUrl, 'https://api.openai.com/v1/responses');
  assert.equal(
    new Headers(requestInit?.headers).get('authorization'),
    'Bearer test-key',
  );
  assert.equal(requestBody?.model, 'gpt-4o-mini');
  assert.equal(requestBody?.temperature, 0);
  assert.equal(requestBody?.store, false);
  const text = requestBody?.text as Record<string, unknown>;
  const format = text.format as Record<string, unknown>;
  assert.equal(format.type, 'json_schema');
  assert.equal(format.strict, true);
  assert.equal(
    (format.schema as Record<string, unknown>).additionalProperties,
    false,
  );
});

test('OpenAI adapter maps rate limits, refusals and missing keys safely', async () => {
  const rateLimitedProvider = createOpenAIResumeWritingProvider({
    apiKey: 'test-key',
    fetchImplementation: async () =>
      new Response(
        JSON.stringify({
          error: { message: 'busy', type: 'rate_limit_error' },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
  });

  await assert.rejects(
    () =>
      rateLimitedProvider.generate({
        prompt: { system: 'system', user: 'user' },
      }),
    (error) =>
      error instanceof OpenAIResumeWritingProviderError &&
      error.kind === 'rate-limited',
  );

  const refusalProvider = createOpenAIResumeWritingProvider({
    apiKey: 'test-key',
    fetchImplementation: async () =>
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [{ type: 'refusal', refusal: 'Unable to comply.' }],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  });

  await assert.rejects(
    () =>
      refusalProvider.generate({
        prompt: { system: 'system', user: 'user' },
      }),
    (error) =>
      error instanceof OpenAIResumeWritingProviderError &&
      error.kind === 'invalid-response',
  );

  const malformedProvider = createOpenAIResumeWritingProvider({
    apiKey: 'test-key',
    fetchImplementation: async () =>
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'not json' }],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  });

  await assert.rejects(
    () =>
      malformedProvider.generate({
        prompt: { system: 'system', user: 'user' },
      }),
    (error) =>
      error instanceof OpenAIResumeWritingProviderError &&
      error.kind === 'invalid-response',
  );

  const unavailableProvider = createOpenAIResumeWritingProvider({
    apiKey: '   ',
  });

  await assert.rejects(
    () =>
      unavailableProvider.generate({
        prompt: { system: 'system', user: 'user' },
      }),
    (error) =>
      error instanceof OpenAIResumeWritingProviderError &&
      error.kind === 'unavailable',
  );
});

test('review decisions are immutable and do not alter the generated proposal', () => {
  const generated = proposal({
    summary: { text: 'Customer service', sourceRefs: ['e-service'] },
    suggestedSkills: [
      { text: 'Customer service', sourceRefs: ['e-service'] },
    ],
  });
  const before = structuredClone(generated);
  const initial = createInitialResumeWritingReviewState('job-a');
  const ids = allResumeWritingSuggestionIds(generated);
  const accepted = resumeWritingReviewReducer(initial, {
    type: 'all-safe/accepted',
    suggestionIds: ids,
  });
  const changed = resumeWritingReviewReducer(accepted, {
    type: 'suggestion/kept-original',
    suggestionId: ids[0] as string,
  });

  assert.notEqual(initial, accepted);
  assert.equal(accepted.decisions[ids[1] as string], 'accepted');
  assert.equal(changed.decisions[ids[0] as string], 'kept-original');
  assert.deepEqual(generated, before);
});

function tailoredResumeFixture(): {
  readonly original: ResumeViewModel;
  readonly proposal: GeneratedResumeProposal;
} {
  const original: ResumeViewModel = {
    candidate: {
      name: 'Taylor Candidate',
      contact: {
        phone: '0400 000 000',
        email: 'taylor@example.com',
        location: 'Sydney, NSW',
      },
    },
    targetJobTitle: 'Software Developer',
    sections: {
      experience: [
        {
          id: 'exp-1',
          kind: 'employment',
          roleTitle: 'Developer',
          organisation: 'Example Company',
          dateRange: 'Jan 2024 – Present',
          highlights: [
            {
              sourceFactId: 'fact-service',
              text: 'Helped customers and put stock on shelves.',
            },
            {
              sourceFactId: 'fact-api',
              text: 'Built backend APIs with TypeScript.',
            },
          ],
        },
      ],
      skills: [
        {
          id: 'skill-typescript',
          name: 'TypeScript',
          category: 'technical',
          source: 'user',
          evidenceFactIds: ['fact-api'],
        },
      ],
    },
  };
  const input = baseInput({
    resume: {
      targetJobTitle: 'Software Developer',
      experience: [
        {
          id: 'exp-1',
          roleTitle: 'Developer',
          description: null,
          highlights: [
            {
              sourceFactId: 'fact-service',
              text: 'Helped customers and put stock on shelves.',
            },
            {
              sourceFactId: 'fact-api',
              text: 'Built backend APIs with TypeScript.',
            },
          ],
        },
      ],
      education: [],
      skills: [{ id: 'skill-typescript', name: 'TypeScript' }],
      licences: [],
    },
    candidateEvidence: [
      evidence('e-typescript', 'TypeScript', {
        sourceId: 'skill-typescript',
      }),
      evidence('e-service', 'Helped customers and put stock on shelves.', {
        source: 'experience-highlight',
        sourceId: 'fact-service',
        parentSourceId: 'exp-1',
        evidenceClass: 'responsibility',
      }),
      evidence('e-api', 'Built backend APIs with TypeScript.', {
        source: 'experience-highlight',
        sourceId: 'fact-api',
        parentSourceId: 'exp-1',
        evidenceClass: 'responsibility',
      }),
    ],
  });
  const validated = validateGeneratedResumeProposal(
    proposal({
      summary: {
        text: 'Practical TypeScript experience.',
        sourceRefs: ['e-typescript'],
      },
      experience: [
        {
          experienceId: 'exp-1',
          bullets: [
            {
              text: 'Assisted customers and replenished stock on shelves.',
              sourceRefs: ['e-service'],
            },
            {
              text: 'Developed backend APIs with TypeScript.',
              sourceRefs: ['e-api'],
            },
          ],
        },
      ],
      suggestedSkills: [
        { text: 'TypeScript', sourceRefs: ['e-typescript'] },
      ],
    }),
    input,
  );

  assert.equal(validated.rejectedStatements, 0);
  return { original, proposal: validated.proposal };
}

test('accepted wording forms a reversible overlay without changing original facts', () => {
  const { original, proposal: safeProposal } = tailoredResumeFixture();
  const originalSnapshot = structuredClone(original);
  const firstBulletId = experienceSuggestionId('exp-1', 0);
  const secondBulletId = experienceSuggestionId('exp-1', 1);
  let review = createInitialResumeWritingReviewState('job-a');

  review = resumeWritingReviewReducer(review, {
    type: 'suggestion/accepted',
    suggestionId: firstBulletId,
  });
  review = resumeWritingReviewReducer(review, {
    type: 'suggestion/kept-original',
    suggestionId: secondBulletId,
  });
  review = resumeWritingReviewReducer(review, {
    type: 'suggestion/accepted',
    suggestionId: summarySuggestionId,
  });

  const tailored = buildTailoredResumeViewModel(
    original,
    safeProposal,
    review,
  );
  assert.equal(review.viewMode, 'tailored');
  assert.equal(tailored.summary, 'Practical TypeScript experience.');
  assert.deepEqual(
    tailored.sections.experience?.[0]?.highlights?.map((item) => item.text),
    [
      'Assisted customers and replenished stock on shelves.',
      'Built backend APIs with TypeScript.',
    ],
  );
  assert.deepEqual(original, originalSnapshot);

  review = resumeWritingReviewReducer(review, {
    type: 'suggestion/undone',
    suggestionId: firstBulletId,
  });
  const afterUndo = buildTailoredResumeViewModel(
    original,
    safeProposal,
    review,
  );
  assert.equal(
    afterUndo.sections.experience?.[0]?.highlights?.[0]?.text,
    'Helped customers and put stock on shelves.',
  );
  assert.equal(afterUndo.summary, 'Practical TypeScript experience.');

  review = resumeWritingReviewReducer(review, { type: 'all/reset' });
  assert.equal(review.viewMode, 'original');
  assert.deepEqual(
    buildTailoredResumeViewModel(original, safeProposal, review),
    original,
  );
  assert.deepEqual(original, originalSnapshot);
});

test('PDF and DOCX render only the accepted tailored wording', async () => {
  const { original, proposal: safeProposal } = tailoredResumeFixture();
  const originalSnapshot = structuredClone(original);
  let review = createInitialResumeWritingReviewState('job-a');

  for (const suggestionId of [
    summarySuggestionId,
    experienceSuggestionId('exp-1', 0),
    skillSuggestionId(0),
  ]) {
    review = resumeWritingReviewReducer(review, {
      type: 'suggestion/accepted',
      suggestionId,
    });
  }
  review = resumeWritingReviewReducer(review, {
    type: 'suggestion/kept-original',
    suggestionId: experienceSuggestionId('exp-1', 1),
  });

  const tailored = buildTailoredResumeViewModel(
    original,
    safeProposal,
    review,
  );
  const templateIds: readonly TemplateId[] = [
    'australian-standard',
    'professional',
    'modern',
  ];

  for (const templateId of templateIds) {
    const pdfContent = JSON.stringify(
      resumePdfTemplates[templateId].buildDocument(tailored).content,
    );
    assert.match(pdfContent, /Practical TypeScript experience\./);
    assert.match(
      pdfContent,
      /Assisted customers and replenished stock on shelves\./,
    );
    assert.doesNotMatch(pdfContent, /Developed backend APIs/);
    assert.match(pdfContent, /Built backend APIs with TypeScript\./);

    const docxBuffer = await Packer.toBuffer(
      resumeDocxTemplates[templateId].buildDocument(tailored),
    );
    const zip = await JSZip.loadAsync(docxBuffer);
    const documentXml = await zip
      .file('word/document.xml')
      ?.async('string');
    assert.ok(documentXml);
    assert.match(documentXml, /Practical TypeScript experience\./);
    assert.match(
      documentXml,
      /Assisted customers and replenished stock on shelves\./,
    );
    assert.doesNotMatch(documentXml, /Developed backend APIs/);
    assert.match(documentXml, /Built backend APIs with TypeScript\./);
  }

  assert.deepEqual(original, originalSnapshot);
});

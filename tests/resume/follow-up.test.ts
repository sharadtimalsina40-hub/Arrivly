import assert from 'node:assert/strict';
import test from 'node:test';
import type { JobAnalysisV1 } from '../../src/features/resume/ai/job-analysis/types';
import {
  addFollowUpEvidence,
  buildConfirmedFollowUpEvidence,
  buildFollowUpConfirmationIndex,
  followUpEvidenceToCandidateEvidence,
  getAustralianYearMonth,
} from '../../src/features/resume/follow-up/evidence';
import { buildFollowUpQuestionBatch } from '../../src/features/resume/follow-up/questions';
import {
  createInitialFollowUpState,
  followUpReducer,
  type FollowUpAction,
} from '../../src/features/resume/follow-up/reducer';
import type {
  FollowUpQuestion,
  FollowUpState,
} from '../../src/features/resume/follow-up/types';
import { buildCandidateEvidenceIndex } from '../../src/features/resume/matching/candidate-evidence';
import { matchJobRequirements } from '../../src/features/resume/matching/matcher';
import type { JobMatchResult } from '../../src/features/resume/matching/types';
import { createInitialResumeDraft } from '../../src/features/resume/model/defaults';
import { buildResumeViewModel } from '../../src/features/resume/model/preview-model';
import type { ResumeDraftV1 } from '../../src/features/resume/model/types';

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

function baseDraft(overrides: Partial<ResumeDraftV1> = {}): ResumeDraftV1 {
  return {
    ...createInitialResumeDraft({
      id: 'follow-up-test-draft',
      timestamp: '2026-09-15T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function reduce(
  state: FollowUpState,
  ...actions: readonly FollowUpAction[]
): FollowUpState {
  return actions.reduce(followUpReducer, state);
}

function committedAnswer(
  state: FollowUpState,
  question: FollowUpQuestion,
  response: 'yes' | 'no' | 'not-sure' | 'depends',
  details = '',
): FollowUpState {
  const actions: FollowUpAction[] = [
    {
      type: 'answer/response-changed',
      questionId: question.id,
      response,
    },
  ];

  if (details) {
    actions.push({
      type: 'answer/details-changed',
      questionId: question.id,
      details,
    });
  }

  actions.push({
    type: 'answer/committed',
    questionId: question.id,
    nextQuestionId: null,
  });

  return reduce(state, ...actions);
}

interface FollowUpPipeline {
  readonly baseline: JobMatchResult;
  readonly questions: readonly FollowUpQuestion[];
  readonly enriched: JobMatchResult;
  readonly positiveEvidenceCount: number;
}

function runPipeline(
  analysis: JobAnalysisV1,
  draft: ResumeDraftV1,
  state: FollowUpState,
): FollowUpPipeline {
  const canonicalEvidence = buildCandidateEvidenceIndex(draft);
  const baseline = matchJobRequirements(analysis, canonicalEvidence);
  const questions = buildFollowUpQuestionBatch(baseline).questions;
  const confirmed = buildConfirmedFollowUpEvidence(
    questions,
    state,
    '2026-09',
  );
  const supplemental = followUpEvidenceToCandidateEvidence(
    confirmed,
    questions,
  );
  const enriched = matchJobRequirements(
    analysis,
    addFollowUpEvidence(canonicalEvidence, supplemental),
    buildFollowUpConfirmationIndex(questions, state),
  );

  return {
    baseline,
    questions,
    enriched,
    positiveEvidenceCount: supplemental.length,
  };
}

function findQuestion(
  questions: readonly FollowUpQuestion[],
  requirement: string,
): FollowUpQuestion {
  const question = questions.find(
    (candidate) => candidate.requirement === requirement,
  );
  assert.ok(question, `Expected a follow-up question for ${requirement}`);
  return question;
}

function findStatus(result: JobMatchResult, requirement: string) {
  const match = result.matches.find(
    (candidate) => candidate.requirement.label === requirement,
  );
  assert.ok(match, `Expected a match for ${requirement}`);
  return match;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
}

test('uses the Australia/Sydney calendar month at the UTC month boundary', () => {
  assert.equal(
    getAustralianYearMonth(new Date('2026-09-30T14:30:00.000Z')),
    '2026-10',
  );
});

test('generates a deterministic, priority-ordered, capped batch and safely deduplicates aliases', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [
      { name: 'POS', evidenceText: 'POS is required' },
      { name: 'AWS', evidenceText: 'AWS is required' },
      { name: 'Docker', evidenceText: 'Docker is required' },
      { name: 'Git', evidenceText: 'Git is required' },
      { name: 'TypeScript', evidenceText: 'TypeScript is required' },
    ],
    preferredSkills: [
      {
        name: 'Point of sale systems',
        evidenceText: 'Point of sale systems are preferred',
      },
      { name: 'React', evidenceText: 'React is preferred' },
    ],
    certifications: [
      { value: 'RSA', evidenceText: 'A current RSA is listed' },
    ],
  });
  const baseline = matchJobRequirements(
    analysis,
    buildCandidateEvidenceIndex(baseDraft()),
  );
  const first = buildFollowUpQuestionBatch(baseline);
  const second = buildFollowUpQuestionBatch(baseline);

  assert.deepEqual(first, second);
  assert.equal(first.questions.length, 5);
  assert.equal(first.totalEligible, 7);
  assert.equal(first.truncated, true);
  assert.deepEqual(
    first.questions.map((question) => question.priority),
    ['required', 'required', 'required', 'required', 'required'],
  );
  assert.equal(
    first.questions.filter((question) => question.kind === 'tool-system')
      .length,
    1,
  );
  assert.equal(first.questions[0].coveredRequirementIds.length, 2);
});

test('never deduplicates a narrower question with a stronger or different claim', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [
      { name: 'React', evidenceText: 'React is required' },
      { name: 'React Native', evidenceText: 'React Native is required' },
      { name: 'AWS', evidenceText: 'AWS is required' },
      {
        name: 'AWS certification',
        evidenceText: 'AWS certification is required',
      },
    ],
  });
  const batch = buildFollowUpQuestionBatch(
    matchJobRequirements(analysis, buildCandidateEvidenceIndex(baseDraft())),
  );

  assert.deepEqual(
    batch.questions.map((question) => question.requirement),
    ['React', 'React Native', 'AWS', 'AWS certification'],
  );
  assert.ok(
    batch.questions.every(
      (question) => question.coveredRequirementIds.length === 1,
    ),
  );
});

test('does not ask about matched, related, confirmed-missing, conflicting or sensitive requirements', () => {
  const draft = baseDraft({
    skills: [
      {
        id: 'skill-typescript',
        name: 'TypeScript',
        category: 'technical',
        source: 'user',
        evidenceFactIds: [],
      },
    ],
    adaptiveAnswers: [
      {
        id: 'pos-no',
        questionId: 'retail-pos',
        occupationProfileId: 'retail',
        answer: { kind: 'boolean', value: false },
        confirmed: true,
      },
    ],
  });
  const analysis = emptyAnalysis({
    requiredSkills: [
      { name: 'TypeScript', evidenceText: 'TypeScript required' },
      { name: 'POS', evidenceText: 'POS required' },
      { name: 'Age', evidenceText: 'Age requested' },
    ],
  });
  const batch = buildFollowUpQuestionBatch(
    matchJobRequirements(analysis, buildCandidateEvidenceIndex(draft)),
  );

  assert.deepEqual(batch.questions, []);
});

test('reducer keeps immutable session state and clears stale Yes-only detail fields', () => {
  const initial = deepFreeze(createInitialFollowUpState('job-a'));
  const first = reduce(initial, {
    type: 'answer/response-changed',
    questionId: 'question-aws',
    response: 'yes',
  });
  const detailed = reduce(first, {
    type: 'answer/details-changed',
    questionId: 'question-aws',
    details: 'Used EC2 and S3 in a university project',
  });
  const committed = reduce(detailed, {
    type: 'answer/committed',
    questionId: 'question-aws',
    nextQuestionId: null,
  });
  const changedToNo = reduce(committed, {
    type: 'answer/response-changed',
    questionId: 'question-aws',
    response: 'no',
  });

  assert.equal(initial.answers.length, 0);
  assert.equal(committed.answers[0].status, 'confirmed');
  assert.equal(changedToNo.answers[0].details, '');
  assert.equal(changedToNo.answers[0].status, 'unanswered');
  assert.equal(changedToNo.contextKey, 'job-a');
  assert.deepEqual(
    followUpReducer(changedToNo, {
      type: 'context/reset',
      contextKey: 'job-b',
    }),
    createInitialFollowUpState('job-b'),
  );
});

test('AWS Yes plus exact details creates provenance-backed evidence and reruns to matched', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'AWS', evidenceText: 'AWS is required' }],
  });
  const draft = deepFreeze(baseDraft());
  const analysisSnapshot = structuredClone(analysis);
  const draftSnapshot = structuredClone(draft);
  const baseline = runPipeline(
    analysis,
    draft,
    createInitialFollowUpState('job-aws'),
  );
  const question = findQuestion(baseline.questions, 'AWS');
  const state = committedAnswer(
    createInitialFollowUpState('job-aws'),
    question,
    'yes',
    'Used EC2 and S3 in a university project',
  );
  const result = runPipeline(analysis, draft, state);
  const match = findStatus(result.enriched, 'AWS');
  const evidence = result.enriched.evidenceIndex.items.find(
    (item) => item.source === 'follow-up',
  );

  assert.equal(findStatus(result.baseline, 'AWS').status, 'unresolved');
  assert.equal(match.status, 'matched');
  assert.equal(result.positiveEvidenceCount, 1);
  assert.equal(evidence?.text, 'Used EC2 and S3 in a university project');
  assert.equal(evidence?.metadata?.questionId, question.id);
  assert.equal(evidence?.metadata?.requirementId, question.requirementId);
  assert.equal(evidence?.metadata?.response, 'yes');
  assert.deepEqual(analysis, analysisSnapshot);
  assert.deepEqual(draft, draftSnapshot);
  assert.equal(draft.skills.some((skill) => skill.name === 'AWS'), false);
});

test('a committed Yes without optional details still confirms the exact question', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'AWS', evidenceText: 'AWS required' }],
  });
  const baseline = runPipeline(
    analysis,
    baseDraft(),
    createInitialFollowUpState('job'),
  );
  const question = findQuestion(baseline.questions, 'AWS');
  const result = runPipeline(
    analysis,
    baseDraft(),
    committedAnswer(createInitialFollowUpState('job'), question, 'yes'),
  );

  assert.equal(findStatus(result.enriched, 'AWS').status, 'matched');
  assert.equal(
    result.enriched.evidenceIndex.items.find(
      (item) => item.source === 'follow-up',
    )?.text,
    'Yes',
  );
});

test('RSA No creates no CandidateEvidence and becomes confirmed-missing through separate confirmation provenance', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'RSA', evidenceText: 'Current RSA required' }],
  });
  const baseline = runPipeline(
    analysis,
    baseDraft(),
    createInitialFollowUpState('job-rsa'),
  );
  const question = findQuestion(baseline.questions, 'RSA');
  assert.equal(question.kind, 'licence-certification');
  const state = committedAnswer(
    createInitialFollowUpState('job-rsa'),
    question,
    'no',
  );
  const result = runPipeline(analysis, baseDraft(), state);
  const match = findStatus(result.enriched, 'RSA');

  assert.equal(result.positiveEvidenceCount, 0);
  assert.equal(
    result.enriched.evidenceIndex.items.some(
      (item) => item.source === 'follow-up',
    ),
    false,
  );
  assert.equal(match.status, 'confirmed-missing');
  assert.equal(match.basis, 'follow-up-decline');
  assert.equal(match.evidenceRefs.length, 0);
  assert.equal(match.confirmationRefs.length, 1);
});

test('RSA Yes is strict certification evidence rather than inferred hospitality experience', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'RSA', evidenceText: 'Current RSA required' }],
  });
  const draft = baseDraft({
    experience: [
      {
        id: 'cafe-job',
        kind: 'employment',
        roleTitle: 'Cafe assistant',
        organisation: 'Example Cafe',
        isCurrent: false,
        highlights: [],
      },
    ],
  });
  const baseline = runPipeline(
    analysis,
    draft,
    createInitialFollowUpState('job-rsa'),
  );
  assert.equal(findStatus(baseline.baseline, 'RSA').status, 'unresolved');
  const question = findQuestion(baseline.questions, 'RSA');
  const state = reduce(
    createInitialFollowUpState('job-rsa'),
    {
      type: 'answer/response-changed',
      questionId: question.id,
      response: 'yes',
    },
    {
      type: 'answer/jurisdiction-changed',
      questionId: question.id,
      jurisdiction: 'NSW',
    },
    {
      type: 'answer/expiry-changed',
      questionId: question.id,
      expiryDate: '2027-08',
    },
    {
      type: 'answer/committed',
      questionId: question.id,
      nextQuestionId: null,
    },
  );
  const result = runPipeline(analysis, draft, state);
  const evidence = result.enriched.evidenceIndex.items.find(
    (item) => item.source === 'follow-up',
  );

  assert.equal(findStatus(result.enriched, 'RSA').status, 'matched');
  assert.equal(evidence?.evidenceClass, 'certification');
  assert.equal(evidence?.metadata?.jurisdiction, 'NSW');
  assert.equal(evidence?.metadata?.expiryDate, '2027-08');
});

test('a past credential expiry never becomes positive matching evidence', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'RSA', evidenceText: 'Current RSA required' }],
  });
  const baseline = runPipeline(
    analysis,
    baseDraft(),
    createInitialFollowUpState('job-rsa-expired'),
  );
  const question = findQuestion(baseline.questions, 'RSA');
  const state = reduce(
    createInitialFollowUpState('job-rsa-expired'),
    {
      type: 'answer/response-changed',
      questionId: question.id,
      response: 'yes',
    },
    {
      type: 'answer/expiry-changed',
      questionId: question.id,
      expiryDate: '2025-12',
    },
    {
      type: 'answer/committed',
      questionId: question.id,
      nextQuestionId: null,
    },
  );
  const result = runPipeline(analysis, baseDraft(), state);

  assert.equal(result.positiveEvidenceCount, 0);
  assert.equal(findStatus(result.enriched, 'RSA').status, 'unresolved');
});

test('shared classifiers let credential, availability and soft-skill Yes answers match', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [
      {
        name: 'Security clearance',
        evidenceText: 'Security clearance is required',
      },
      { name: 'Weekends', evidenceText: 'Weekends are required' },
    ],
    softSkills: [
      { value: 'Communication', evidenceText: 'Communication is required' },
    ],
  });
  const baseline = runPipeline(
    analysis,
    baseDraft(),
    createInitialFollowUpState('job-classifiers'),
  );
  const clearance = findQuestion(baseline.questions, 'Security clearance');
  const weekends = findQuestion(baseline.questions, 'Weekends');
  const communication = findQuestion(baseline.questions, 'Communication');

  assert.equal(clearance.kind, 'licence-certification');
  assert.equal(weekends.kind, 'availability');
  assert.equal(communication.kind, 'skill');

  let state = committedAnswer(
    createInitialFollowUpState('job-classifiers'),
    clearance,
    'yes',
  );
  state = committedAnswer(state, weekends, 'yes');
  state = committedAnswer(state, communication, 'yes');
  const result = runPipeline(analysis, baseDraft(), state);

  assert.equal(
    findStatus(result.enriched, 'Security clearance').status,
    'matched',
  );
  assert.equal(findStatus(result.enriched, 'Weekends').status, 'matched');
  assert.equal(
    findStatus(result.enriched, 'Communication').status,
    'matched',
  );
});

test('Not sure and conditional availability create neither evidence nor a decline', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [
      { name: 'Docker', evidenceText: 'Docker required' },
      {
        name: 'Weekend availability',
        evidenceText: 'Weekend availability required',
      },
    ],
  });
  const baseline = runPipeline(
    analysis,
    baseDraft(),
    createInitialFollowUpState('job'),
  );
  const docker = findQuestion(baseline.questions, 'Docker');
  const weekends = findQuestion(baseline.questions, 'Weekend availability');
  assert.equal(weekends.allowsDepends, true);
  const state = committedAnswer(
    committedAnswer(
      createInitialFollowUpState('job'),
      docker,
      'not-sure',
    ),
    weekends,
    'depends',
    'Available every second Saturday.',
  );
  const result = runPipeline(analysis, baseDraft(), state);

  assert.equal(result.positiveEvidenceCount, 0);
  assert.equal(result.enriched.confirmationIndex.items.length, 0);
  assert.equal(findStatus(result.enriched, 'Docker').status, 'unresolved');
  assert.equal(
    findStatus(result.enriched, 'Weekend availability').status,
    'unresolved',
  );
  assert.equal(
    state.answers.find((answer) => answer.questionId === weekends.id)?.details,
    'Available every second Saturday.',
  );
});

test('changing Yes to No removes stale positive evidence, and No to Yes removes the decline', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'AWS', evidenceText: 'AWS required' }],
  });
  const baseline = runPipeline(
    analysis,
    baseDraft(),
    createInitialFollowUpState('job'),
  );
  const question = findQuestion(baseline.questions, 'AWS');
  const yes = committedAnswer(
    createInitialFollowUpState('job'),
    question,
    'yes',
    'Used EC2 in a university project',
  );
  const no = reduce(
    yes,
    {
      type: 'answer/response-changed',
      questionId: question.id,
      response: 'no',
    },
    {
      type: 'answer/committed',
      questionId: question.id,
      nextQuestionId: null,
    },
  );
  const noResult = runPipeline(analysis, baseDraft(), no);
  assert.equal(noResult.positiveEvidenceCount, 0);
  assert.equal(findStatus(noResult.enriched, 'AWS').status, 'confirmed-missing');

  const yesAgain = reduce(
    no,
    {
      type: 'answer/response-changed',
      questionId: question.id,
      response: 'yes',
    },
    {
      type: 'answer/committed',
      questionId: question.id,
      nextQuestionId: null,
    },
  );
  const yesAgainResult = runPipeline(analysis, baseDraft(), yesAgain);
  assert.equal(yesAgainResult.positiveEvidenceCount, 1);
  assert.equal(yesAgainResult.enriched.confirmationIndex.items.length, 0);
  assert.equal(findStatus(yesAgainResult.enriched, 'AWS').status, 'matched');
});

test('preferred questions retain preferred priority and update only the preferred summary', () => {
  const analysis = emptyAnalysis({
    preferredSkills: [{ name: 'Docker', evidenceText: 'Docker preferred' }],
  });
  const baseline = runPipeline(
    analysis,
    baseDraft(),
    createInitialFollowUpState('job'),
  );
  const question = findQuestion(baseline.questions, 'Docker');
  assert.equal(question.priority, 'preferred');
  const result = runPipeline(
    analysis,
    baseDraft(),
    committedAnswer(createInitialFollowUpState('job'), question, 'yes'),
  );

  assert.equal(result.enriched.summary.preferred.matched, 1);
  assert.equal(result.enriched.summary.required.total, 0);
});

test('cafe flow confirms POS, declines RSA and leaves the canonical draft unchanged', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [
      { name: 'Customer service', evidenceText: 'Customer service required' },
      { name: 'POS', evidenceText: 'POS required' },
      { name: 'RSA', evidenceText: 'RSA required' },
      {
        name: 'Weekend availability',
        evidenceText: 'Weekend availability required',
      },
    ],
  });
  const draft = deepFreeze(
    baseDraft({
      skills: [
        {
          id: 'customer-service',
          name: 'Customer Service',
          category: 'industry',
          source: 'user',
          evidenceFactIds: [],
        },
      ],
      availability: {
        employmentTypes: [],
        days: ['saturday', 'sunday'],
        shifts: [],
      },
    }),
  );
  const draftSnapshot = structuredClone(draft);
  const viewModelSnapshot = buildResumeViewModel(draft);
  const baseline = runPipeline(
    analysis,
    draft,
    createInitialFollowUpState('cafe-job'),
  );
  const pos = findQuestion(baseline.questions, 'POS');
  const rsa = findQuestion(baseline.questions, 'RSA');
  let state = committedAnswer(
    createInitialFollowUpState('cafe-job'),
    pos,
    'yes',
    'Used a cash register in our family grocery store.',
  );
  state = committedAnswer(state, rsa, 'no');
  const result = runPipeline(analysis, draft, state);

  assert.equal(findStatus(result.enriched, 'POS').status, 'matched');
  assert.equal(findStatus(result.enriched, 'RSA').status, 'confirmed-missing');
  assert.equal(
    findStatus(result.enriched, 'Customer service').status,
    'matched',
  );
  assert.equal(
    findStatus(result.enriched, 'Weekend availability').status,
    'matched',
  );
  assert.deepEqual(draft, draftSnapshot);
  assert.deepEqual(buildResumeViewModel(draft), viewModelSnapshot);
  assert.equal(draft.skills.some((skill) => skill.name === 'POS'), false);
  assert.equal(draft.licences.some((licence) => licence.name === 'RSA'), false);
});

test('software flow matches AWS details while Docker Not sure remains unresolved', () => {
  const analysis = emptyAnalysis({
    requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'AWS'].map(
      (name) => ({ name, evidenceText: `${name} required` }),
    ),
    preferredSkills: [
      { name: 'Docker', evidenceText: 'Docker preferred' },
    ],
  });
  const draft = baseDraft({
    skills: ['TypeScript', 'NodeJS', 'Postgres'].map((name, index) => ({
      id: `skill-${index}`,
      name,
      category: 'technical' as const,
      source: 'user' as const,
      evidenceFactIds: [],
    })),
  });
  const baseline = runPipeline(
    analysis,
    draft,
    createInitialFollowUpState('software-job'),
  );
  const aws = findQuestion(baseline.questions, 'AWS');
  const docker = findQuestion(baseline.questions, 'Docker');
  let state = committedAnswer(
    createInitialFollowUpState('software-job'),
    aws,
    'yes',
    'Used EC2 and S3 in a university project.',
  );
  state = committedAnswer(state, docker, 'not-sure');
  const result = runPipeline(analysis, draft, state);

  assert.equal(findStatus(result.enriched, 'AWS').status, 'matched');
  assert.equal(findStatus(result.enriched, 'Docker').status, 'unresolved');
  assert.equal('score' in result.enriched, false);
});

test('all-matched and no-requirement analyses create no unnecessary questions', () => {
  const matchedDraft = baseDraft({
    skills: [
      {
        id: 'typescript',
        name: 'TypeScript',
        category: 'technical',
        source: 'user',
        evidenceFactIds: [],
      },
    ],
  });
  const matched = matchJobRequirements(
    emptyAnalysis({
      requiredSkills: [
        { name: 'TypeScript', evidenceText: 'TypeScript required' },
      ],
    }),
    buildCandidateEvidenceIndex(matchedDraft),
  );
  const empty = matchJobRequirements(
    emptyAnalysis(),
    buildCandidateEvidenceIndex(baseDraft()),
  );

  assert.equal(buildFollowUpQuestionBatch(matched).questions.length, 0);
  assert.equal(buildFollowUpQuestionBatch(empty).questions.length, 0);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import type { JobAnalysisV1 } from '../../src/features/resume/ai/job-analysis/types';
import { buildCandidateEvidenceIndex } from '../../src/features/resume/matching/candidate-evidence';
import { matchJobRequirements } from '../../src/features/resume/matching/matcher';
import {
  buildNormalizedTerms,
  findEquivalentMatch,
} from '../../src/features/resume/matching/normalize';
import type {
  JobMatchResult,
  RequirementMatch,
} from '../../src/features/resume/matching/types';
import { createInitialResumeDraft } from '../../src/features/resume/model/defaults';
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
      id: 'resume-test',
      timestamp: '2026-09-14T00:00:00.000Z',
    }),
    targetJob: {
      desiredTitle: 'Test role',
      jobAdvertisement: { status: 'provided', text: 'AWS is required.' },
      occupation: {
        profileId: 'software',
        selectedBy: 'user',
        confirmed: true,
      },
    },
    ...overrides,
  };
}

function findMatch(
  result: JobMatchResult,
  requirement: string,
): RequirementMatch {
  const match = result.matches.find(
    (candidate) => candidate.requirement.label === requirement,
  );
  assert.ok(match, `Expected a match result for ${requirement}`);
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

function match(analysis: JobAnalysisV1, draft: ResumeDraftV1): JobMatchResult {
  return matchJobRequirements(analysis, buildCandidateEvidenceIndex(draft));
}

test('matches software exact facts and aliases without confusing GitHub with Git', () => {
  const analysis = emptyAnalysis({
    requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Git'].map(
      (name) => ({ name, evidenceText: `${name} is required` }),
    ),
    preferredSkills: ['AWS', 'CI/CD'].map((name) => ({
      name,
      evidenceText: `${name} is preferred`,
    })),
  });
  const draft = baseDraft({
    skills: [
      ['skill-ts', 'TypeScript'],
      ['skill-node', 'NodeJS'],
      ['skill-postgres', 'Postgres'],
      ['skill-actions', 'GitHub Actions'],
    ].map(([id, name]) => ({
      id,
      name,
      category: 'technical' as const,
      source: 'user' as const,
      evidenceFactIds: [],
    })),
    experience: [
      {
        id: 'experience-api',
        kind: 'employment',
        roleTitle: 'Backend Developer',
        organisation: 'Example Co',
        isCurrent: true,
        highlights: [
          {
            id: 'fact-api',
            category: 'skill-evidence',
            text: 'Built REST APIs using Node.js and PostgreSQL',
            source: 'user',
          },
        ],
      },
    ],
  });
  const result = match(analysis, draft);

  assert.equal(findMatch(result, 'TypeScript').status, 'matched');
  assert.equal(findMatch(result, 'Node.js').status, 'matched');
  assert.equal(findMatch(result, 'PostgreSQL').status, 'matched');
  assert.equal(findMatch(result, 'Git').status, 'unresolved');
  assert.equal(findMatch(result, 'AWS').status, 'unresolved');
  assert.equal(findMatch(result, 'CI/CD').status, 'related');
  assert.deepEqual(result.summary.required, {
    total: 4,
    matched: 3,
    related: 0,
    unresolved: 1,
    confirmedMissing: 0,
  });
  assert.equal(result.followUpCandidates.length, 1);
  assert.equal(result.followUpCandidates[0].requirement, 'Git');
});

test('uses candidate experience, confirmed POS and structured weekend availability for cafe matching', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [
      { name: 'Customer service', evidenceText: 'Customer service required' },
      { name: 'POS experience', evidenceText: 'POS experience required' },
      {
        name: 'Weekend availability',
        evidenceText: 'Weekend availability required',
      },
    ],
  });
  const draft = baseDraft({
    experience: [
      {
        id: 'experience-grocery',
        kind: 'volunteer',
        roleTitle: 'Family grocery helper',
        organisation: 'Family Grocery',
        isCurrent: false,
        highlights: [
          {
            id: 'fact-customers',
            category: 'responsibility',
            text: 'Helped customers in the family grocery store',
            source: 'user',
          },
        ],
      },
    ],
    adaptiveAnswers: [
      {
        id: 'answer-pos',
        questionId: 'hospitality-pos',
        occupationProfileId: 'hospitality',
        answer: { kind: 'boolean', value: true },
        confirmed: true,
      },
    ],
    availability: {
      employmentTypes: [],
      days: ['saturday', 'sunday'],
      shifts: [],
    },
  });
  const result = match(analysis, draft);

  assert.equal(findMatch(result, 'Customer service').status, 'related');
  assert.equal(findMatch(result, 'POS experience').status, 'matched');
  assert.equal(findMatch(result, 'Weekend availability').status, 'matched');
});

test('keeps retail related evidence and explicit negative answers distinct', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [
      { name: 'Customer service', evidenceText: 'Customer service required' },
      {
        name: 'Stock replenishment',
        evidenceText: 'Stock replenishment required',
      },
      { name: 'POS', evidenceText: 'POS required' },
    ],
  });
  const draft = baseDraft({
    skills: [
      {
        id: 'skill-customer',
        name: 'Customer Service',
        category: 'industry',
        source: 'user',
        evidenceFactIds: [],
      },
    ],
    experience: [
      {
        id: 'experience-retail',
        kind: 'employment',
        roleTitle: 'Shop assistant',
        isCurrent: false,
        highlights: [
          {
            id: 'fact-shelves',
            category: 'responsibility',
            text: 'Refilled shelves',
            source: 'user',
          },
        ],
      },
    ],
    adaptiveAnswers: [
      {
        id: 'answer-retail-pos',
        questionId: 'retail-pos',
        occupationProfileId: 'retail',
        answer: { kind: 'boolean', value: false },
        confirmed: true,
      },
    ],
  });
  const result = match(analysis, draft);

  assert.equal(findMatch(result, 'Customer service').status, 'matched');
  assert.equal(findMatch(result, 'Stock replenishment').status, 'related');
  assert.equal(findMatch(result, 'POS').status, 'confirmed-missing');
  assert.equal(draft.skills.some((skill) => skill.name === 'POS'), false);
});

test('does not treat warehouse activity as evidence of a forklift licence', () => {
  const analysis = emptyAnalysis({
    certifications: [
      {
        value: 'Forklift licence',
        evidenceText: 'A forklift licence is mandatory',
      },
    ],
  });
  const warehouseDraft = baseDraft({
    experience: [
      {
        id: 'experience-warehouse',
        kind: 'employment',
        roleTitle: 'Warehouse worker',
        isCurrent: false,
        highlights: [
          {
            id: 'fact-rf',
            category: 'skill-evidence',
            text: 'Used an RF scanner and completed pick packing',
            source: 'user',
          },
        ],
      },
    ],
  });

  const unresolved = match(analysis, warehouseDraft);
  assert.equal(findMatch(unresolved, 'Forklift licence').status, 'unresolved');
  assert.equal(
    findMatch(unresolved, 'Forklift licence').requirement.importance,
    'unspecified',
  );
  assert.equal(unresolved.followUpCandidates.length, 0);

  const explicitlyMissing = match(analysis, {
    ...warehouseDraft,
    adaptiveAnswers: [
      {
        id: 'answer-forklift-no',
        questionId: 'warehouse-forklift',
        occupationProfileId: 'warehouse-logistics',
        answer: { kind: 'boolean', value: false },
        confirmed: true,
      },
    ],
  });
  assert.equal(
    findMatch(explicitlyMissing, 'Forklift licence').status,
    'confirmed-missing',
  );

  const licensed = match(analysis, {
    ...warehouseDraft,
    licences: [
      {
        id: 'licence-forklift',
        name: 'LF licence',
        issuer: 'WorkSafe',
        jurisdiction: 'VIC',
        status: 'current',
      },
    ],
  });
  assert.equal(findMatch(licensed, 'Forklift licence').status, 'matched');
});

test('keeps accounting credentials and software exact rather than speculative', () => {
  const analysis = emptyAnalysis({
    preferredSkills: [{ name: 'MYOB', evidenceText: 'MYOB is desirable' }],
    qualifications: [
      { value: 'CPA qualification', evidenceText: 'CPA qualification required' },
    ],
    responsibilities: [
      { value: 'Prepare reconciliations', evidenceText: 'Prepare reconciliations' },
    ],
  });
  const draft = baseDraft({
    education: [
      {
        id: 'education-accounting',
        qualification: 'Bachelor of Accounting',
        institution: 'Example University',
        status: 'completed',
        highlights: [],
      },
    ],
    skills: [
      {
        id: 'skill-xero',
        name: 'Xero',
        category: 'software',
        source: 'user',
        evidenceFactIds: [],
      },
    ],
    experience: [
      {
        id: 'experience-accounts',
        kind: 'internship',
        roleTitle: 'Accounts Intern',
        isCurrent: false,
        highlights: [
          {
            id: 'fact-reconciliation',
            category: 'responsibility',
            text: 'Prepared bank reconciliations',
            source: 'user',
          },
        ],
      },
    ],
  });
  const result = match(analysis, draft);

  assert.equal(findMatch(result, 'CPA qualification').status, 'unresolved');
  assert.equal(findMatch(result, 'MYOB').status, 'unresolved');
  assert.equal(findMatch(result, 'Prepare reconciliations').status, 'matched');
});

test('does not confuse RSA with food safety and treats expired exact credentials as related', () => {
  const analysis = emptyAnalysis({
    certifications: [{ value: 'RSA', evidenceText: 'RSA required' }],
  });

  assert.equal(
    findMatch(
      match(analysis, {
        ...baseDraft(),
        licences: [
          {
            id: 'food-safety',
            name: 'Food Safety certificate',
            status: 'current',
          },
        ],
      }),
      'RSA',
    ).status,
    'unresolved',
  );

  assert.equal(
    findMatch(
      match(analysis, {
        ...baseDraft(),
        licences: [{ id: 'rsa-old', name: 'RSA', status: 'expired' }],
      }),
      'RSA',
    ).status,
    'related',
  );
});

test('keeps an incomplete qualification as related rather than completed proof', () => {
  const analysis = emptyAnalysis({
    qualifications: [
      { value: 'Bachelor of Information Technology', evidenceText: 'Bachelor required' },
    ],
  });
  const result = match(analysis, {
    ...baseDraft(),
    education: [
      {
        id: 'education-it',
        qualification: 'Bachelor of Information Technology',
        institution: 'RMIT University',
        status: 'current',
        highlights: [],
      },
    ],
  });

  assert.equal(
    findMatch(result, 'Bachelor of Information Technology').status,
    'related',
  );
});

test('normalizes only controlled equivalents with token boundaries', () => {
  const cases = [
    ['Node.js', 'NodeJS'],
    ['Node.js', 'node js'],
    ['PostgreSQL', 'Postgres'],
    ['AWS', 'Amazon Web Services'],
    ['CI/CD', 'continuous integration'],
  ] as const;

  for (const [requirement, candidate] of cases) {
    assert.ok(findEquivalentMatch(requirement, buildNormalizedTerms(candidate)));
  }

  assert.equal(findEquivalentMatch('Git', buildNormalizedTerms('GitHub Actions')), undefined);
  assert.equal(findEquivalentMatch('POS', buildNormalizedTerms('PostgreSQL')), undefined);
  assert.equal(findEquivalentMatch('RSA', buildNormalizedTerms('versatile')), undefined);
});

test('never indexes the job advertisement, target title, unconfirmed answers or professional links', () => {
  const draft = baseDraft({
    personalDetails: {
      fullName: 'AWS Candidate',
      phone: '0400 000 000',
      email: 'candidate@example.com',
      location: { city: 'Sydney' },
      links: { github: 'https://github.com/aws-example' },
    },
    targetJob: {
      desiredTitle: 'AWS Engineer',
      jobAdvertisement: { status: 'provided', text: 'AWS is required.' },
      occupation: {
        profileId: 'software',
        selectedBy: 'user',
        confirmed: true,
      },
    },
    adaptiveAnswers: [
      {
        id: 'answer-cloud-unconfirmed',
        questionId: 'software-cloud',
        occupationProfileId: 'software',
        answer: { kind: 'text', value: 'AWS' },
        confirmed: false,
      },
    ],
  });
  const index = buildCandidateEvidenceIndex(draft);

  assert.equal(index.items.length, 0);
  assert.equal(index.items.some((item) => item.normalizedTerms.includes('aws')), false);
});

test('obvious negative narrative is never treated as positive evidence', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'AWS', evidenceText: 'AWS required' }],
  });
  const result = match(analysis, {
    ...baseDraft(),
    experience: [
      {
        id: 'experience-negative',
        kind: 'project',
        roleTitle: 'Learning project',
        description: 'No experience with AWS',
        isCurrent: false,
        highlights: [],
      },
    ],
  });

  const aws = findMatch(result, 'AWS');
  assert.equal(aws.status, 'unresolved');
  assert.equal(aws.basis, 'unsafe-to-infer');
});

test('obvious negative narrative cannot become related evidence through a rule', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [
      { name: 'Customer service', evidenceText: 'Customer service required' },
    ],
  });
  const result = match(analysis, {
    ...baseDraft(),
    experience: [
      {
        id: 'experience-no-customers',
        kind: 'employment',
        roleTitle: 'Store room assistant',
        isCurrent: false,
        highlights: [
          {
            id: 'fact-no-customers',
            category: 'responsibility',
            text: 'Never helped customers',
            source: 'user',
          },
        ],
      },
    ],
  });

  assert.equal(findMatch(result, 'Customer service').status, 'unresolved');
  assert.equal(findMatch(result, 'Customer service').basis, 'unsafe-to-infer');
});

test('conflicting confirmed positive and negative evidence remains unresolved', () => {
  const analysis = emptyAnalysis({
    requiredSkills: [{ name: 'POS', evidenceText: 'POS required' }],
  });
  const result = match(analysis, {
    ...baseDraft(),
    skills: [
      {
        id: 'skill-pos',
        name: 'POS',
        category: 'software',
        source: 'user',
        evidenceFactIds: [],
      },
    ],
    adaptiveAnswers: [
      {
        id: 'answer-pos-no',
        questionId: 'retail-pos',
        occupationProfileId: 'retail',
        answer: { kind: 'boolean', value: false },
        confirmed: true,
      },
    ],
  });

  const pos = findMatch(result, 'POS');
  assert.equal(pos.status, 'unresolved');
  assert.equal(pos.basis, 'conflict');
  assert.equal(pos.evidenceRefs.length, 2);
});

test('creates neutral follow-ups only for unresolved required requirements', () => {
  const result = match(
    emptyAnalysis({
      requiredSkills: [{ name: 'AWS', evidenceText: 'AWS required' }],
      preferredSkills: [{ name: 'Git', evidenceText: 'Git preferred' }],
    }),
    baseDraft(),
  );

  assert.deepEqual(
    result.followUpCandidates.map((candidate) => candidate.requirement),
    ['AWS'],
  );
  assert.equal(
    result.followUpCandidates[0].question,
    'Have you used AWS in work, study, volunteering or personal projects?',
  );
  assert.doesNotMatch(
    result.followUpCandidates[0].question,
    /probably|surely|add it|must have/i,
  );
});

test('handles no requirements and very little candidate evidence without scores', () => {
  const emptyResult = match(emptyAnalysis(), baseDraft());
  assert.equal(emptyResult.matches.length, 0);
  assert.equal(emptyResult.summary.required.total, 0);
  assert.equal(emptyResult.followUpCandidates.length, 0);
  assert.equal('score' in emptyResult, false);

  const sparseResult = match(
    emptyAnalysis({
      requiredSkills: [{ name: 'TypeScript', evidenceText: 'TypeScript required' }],
    }),
    baseDraft(),
  );
  assert.equal(findMatch(sparseResult, 'TypeScript').status, 'unresolved');
});

test('keeps many experience sources deterministic, ordered and uniquely referenced', () => {
  const experiences = Array.from({ length: 50 }, (_, index) => ({
    id: `experience-${index}`,
    kind: 'employment' as const,
    roleTitle: `Retail Assistant ${index}`,
    organisation: `Store ${index}`,
    isCurrent: false,
    highlights: [
      {
        id: `fact-${index}`,
        category: 'responsibility' as const,
        text: 'Helped customers',
        source: 'user' as const,
      },
    ],
  }));
  const draft = baseDraft({ experience: experiences });
  const first = buildCandidateEvidenceIndex(draft);
  const second = buildCandidateEvidenceIndex(draft);

  assert.deepEqual(first, second);
  assert.equal(new Set(first.items.map((item) => item.id)).size, first.items.length);
  assert.equal(first.items[0].sourceId, 'experience-0');
  assert.equal(first.items.at(-1)?.sourceId, 'fact-49');
});

test('matcher is pure and every non-empty evidence reference resolves', () => {
  const analysis = deepFreeze(
    emptyAnalysis({
      requiredSkills: [
        { name: 'PostgreSQL', evidenceText: 'PostgreSQL required' },
        { name: 'AWS', evidenceText: 'AWS required' },
      ],
    }),
  );
  const draft = deepFreeze(
    baseDraft({
      experience: [
        {
          id: 'experience-backend',
          kind: 'employment',
          roleTitle: 'Backend Developer',
          isCurrent: false,
          highlights: [
            {
              id: 'fact-postgres',
              category: 'skill-evidence',
              text: 'Built an API using PostgreSQL',
              source: 'user',
            },
          ],
        },
      ],
    }),
  );
  const analysisSnapshot = structuredClone(analysis);
  const draftSnapshot = structuredClone(draft);
  const result = match(analysis, draft);
  const evidenceIds = new Set(result.evidenceIndex.items.map((item) => item.id));
  const postgresqlMatch = findMatch(result, 'PostgreSQL');
  const postgresqlEvidence = result.evidenceIndex.items.find(
    (item) => item.id === postgresqlMatch.evidenceRefs[0],
  );

  assert.equal(postgresqlMatch.status, 'matched');
  assert.equal(postgresqlEvidence?.source, 'experience-highlight');
  assert.equal(postgresqlEvidence?.sourceId, 'fact-postgres');
  assert.equal(findMatch(result, 'AWS').status, 'unresolved');
  assert.equal(
    result.followUpCandidates.some((candidate) => candidate.requirement === 'AWS'),
    true,
  );

  for (const requirementMatch of result.matches) {
    for (const reference of requirementMatch.evidenceRefs) {
      assert.ok(evidenceIds.has(reference));
    }
  }

  assert.deepEqual(analysis, analysisSnapshot);
  assert.deepEqual(draft, draftSnapshot);
  assert.equal('score' in result, false);
  assert.equal(draft.skills.some((skill) => skill.name === 'AWS'), false);
});

import { z } from 'zod';
import type {
  EvidenceBackedJobAnalysisItem,
  JobAnalysisV1,
  JobRequirement,
} from './types';
import { JOB_ANALYSIS_SCHEMA_VERSION } from './types';

export const JOB_ANALYSIS_MAX_ITEMS_PER_SECTION = 40;
export const JOB_ANALYSIS_MAX_LABEL_CHARACTERS = 160;
export const JOB_ANALYSIS_MAX_EVIDENCE_CHARACTERS = 600;

const conciseValueSchema = z
  .string()
  .trim()
  .min(1, 'Extracted values cannot be empty')
  .max(
    JOB_ANALYSIS_MAX_LABEL_CHARACTERS,
    `Extracted values cannot exceed ${JOB_ANALYSIS_MAX_LABEL_CHARACTERS} characters`,
  );

const evidenceTextSchema = z
  .string()
  .trim()
  .min(1, 'Evidence text cannot be empty')
  .max(
    JOB_ANALYSIS_MAX_EVIDENCE_CHARACTERS,
    `Evidence text cannot exceed ${JOB_ANALYSIS_MAX_EVIDENCE_CHARACTERS} characters`,
  );

const evidenceBackedItemSchema: z.ZodType<EvidenceBackedJobAnalysisItem> =
  z
    .object({
      value: conciseValueSchema,
      evidenceText: evidenceTextSchema,
    })
    .strict();

const jobRequirementSchema: z.ZodType<JobRequirement> = z
  .object({
    name: conciseValueSchema,
    evidenceText: evidenceTextSchema,
  })
  .strict();

function boundedArray<T extends z.ZodType>(itemSchema: T) {
  return z.array(itemSchema).max(JOB_ANALYSIS_MAX_ITEMS_PER_SECTION);
}

function normaliseComparableText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-AU');
}

function addDuplicateIssues(
  values: readonly string[],
  path: string,
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();

  values.forEach((value, index) => {
    const comparableValue = normaliseComparableText(value);

    if (seen.has(comparableValue)) {
      context.addIssue({
        code: 'custom',
        path: [path, index],
        message: 'Duplicate extracted item',
      });
    }

    seen.add(comparableValue);
  });
}

const jobAnalysisV1ObjectSchema = z
  .object({
    schemaVersion: z.literal(JOB_ANALYSIS_SCHEMA_VERSION),
    jobTitle: evidenceBackedItemSchema.nullable(),
    employer: evidenceBackedItemSchema.nullable(),
    requiredSkills: boundedArray(jobRequirementSchema),
    preferredSkills: boundedArray(jobRequirementSchema),
    responsibilities: boundedArray(evidenceBackedItemSchema),
    qualifications: boundedArray(evidenceBackedItemSchema),
    certifications: boundedArray(evidenceBackedItemSchema),
    softSkills: boundedArray(evidenceBackedItemSchema),
    keywords: boundedArray(evidenceBackedItemSchema),
    experienceRequirements: boundedArray(evidenceBackedItemSchema),
    otherRequirements: boundedArray(evidenceBackedItemSchema),
  })
  .strict();

/** Strict runtime schema for untrusted AI output. */
export const jobAnalysisV1Schema: z.ZodType<JobAnalysisV1> =
  jobAnalysisV1ObjectSchema.superRefine((analysis, context) => {
    addDuplicateIssues(
      analysis.requiredSkills.map((item) => item.name),
      'requiredSkills',
      context,
    );
    addDuplicateIssues(
      analysis.preferredSkills.map((item) => item.name),
      'preferredSkills',
      context,
    );

    const requiredSkills = new Set(
      analysis.requiredSkills.map((item) => normaliseComparableText(item.name)),
    );

    analysis.preferredSkills.forEach((item, index) => {
      if (requiredSkills.has(normaliseComparableText(item.name))) {
        context.addIssue({
          code: 'custom',
          path: ['preferredSkills', index],
          message: 'A skill cannot be both required and preferred',
        });
      }
    });

    const evidenceSections = [
      ['responsibilities', analysis.responsibilities],
      ['qualifications', analysis.qualifications],
      ['certifications', analysis.certifications],
      ['softSkills', analysis.softSkills],
      ['keywords', analysis.keywords],
      ['experienceRequirements', analysis.experienceRequirements],
      ['otherRequirements', analysis.otherRequirements],
    ] as const;

    for (const [path, items] of evidenceSections) {
      addDuplicateIssues(
        items.map((item) => item.value),
        path,
        context,
      );
    }
  });

/**
 * Provider-facing JSON Schema generated from the same runtime contract.
 * Provider adapters may use this for strict structured output, but the result
 * must still pass `parseJobAnalysis` after it returns.
 */
export const jobAnalysisV1JsonSchema = z.toJSONSchema(
  jobAnalysisV1ObjectSchema,
  { target: 'draft-07' },
);

export interface JobAnalysisValidationIssue {
  path: string;
  message: string;
}

export class JobAnalysisValidationError extends Error {
  readonly code = 'INVALID_JOB_ANALYSIS' as const;
  readonly issues: readonly JobAnalysisValidationIssue[];

  constructor(issues: readonly JobAnalysisValidationIssue[]) {
    super('The job-analysis provider returned an invalid response.');
    this.name = 'JobAnalysisValidationError';
    this.issues = issues;
  }
}

function collectEvidence(
  analysis: JobAnalysisV1,
): ReadonlyArray<{ path: string; evidenceText: string }> {
  const evidence: Array<{ path: string; evidenceText: string }> = [];

  if (analysis.jobTitle) {
    evidence.push({
      path: 'jobTitle.evidenceText',
      evidenceText: analysis.jobTitle.evidenceText,
    });
  }

  if (analysis.employer) {
    evidence.push({
      path: 'employer.evidenceText',
      evidenceText: analysis.employer.evidenceText,
    });
  }

  const requirementSections = [
    ['requiredSkills', analysis.requiredSkills],
    ['preferredSkills', analysis.preferredSkills],
  ] as const;

  for (const [path, items] of requirementSections) {
    items.forEach((item, index) => {
      evidence.push({
        path: `${path}.${index}.evidenceText`,
        evidenceText: item.evidenceText,
      });
    });
  }

  const evidenceSections = [
    ['responsibilities', analysis.responsibilities],
    ['qualifications', analysis.qualifications],
    ['certifications', analysis.certifications],
    ['softSkills', analysis.softSkills],
    ['keywords', analysis.keywords],
    ['experienceRequirements', analysis.experienceRequirements],
    ['otherRequirements', analysis.otherRequirements],
  ] as const;

  for (const [path, items] of evidenceSections) {
    items.forEach((item, index) => {
      evidence.push({
        path: `${path}.${index}.evidenceText`,
        evidenceText: item.evidenceText,
      });
    });
  }

  return evidence;
}

/**
 * Parses untrusted output and checks that every evidence excerpt appears in
 * the source advertisement. Whitespace, case and Unicode compatibility forms
 * are normalised, but paraphrased or invented evidence is rejected.
 */
export function parseJobAnalysis(
  input: unknown,
  sourceJobAdvertisement: string,
): JobAnalysisV1 {
  const parsed = jobAnalysisV1Schema.safeParse(input);

  if (!parsed.success) {
    throw new JobAnalysisValidationError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  const comparableSource = normaliseComparableText(sourceJobAdvertisement);
  const groundingIssues: JobAnalysisValidationIssue[] = [];

  for (const evidence of collectEvidence(parsed.data)) {
    const comparableEvidence = normaliseComparableText(evidence.evidenceText);

    if (
      comparableEvidence.length === 0 ||
      !comparableSource.includes(comparableEvidence)
    ) {
      groundingIssues.push({
        path: evidence.path,
        message: 'Evidence text was not found in the source job advertisement',
      });
    }
  }

  if (groundingIssues.length > 0) {
    throw new JobAnalysisValidationError(groundingIssues);
  }

  return parsed.data;
}

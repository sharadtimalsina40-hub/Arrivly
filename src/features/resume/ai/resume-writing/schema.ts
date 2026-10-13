import { z } from 'zod';
import { jobAnalysisV1Schema } from '../job-analysis/schema';
import {
  buildNormalizedTerms,
  findEquivalentMatch,
  isAvailabilityRequirementLabel,
  isFormalCredentialRequirementLabel,
  isFormalQualificationRequirementLabel,
} from '../../matching/normalize';
import {
  GENERATED_RESUME_PROPOSAL_SCHEMA_VERSION,
  type GeneratedResumeProposal,
  type ResumeWritingInput,
} from './types';

export const RESUME_WRITING_MAX_EVIDENCE_ITEMS = 250;
export const RESUME_WRITING_MAX_TEXT_CHARACTERS = 600;
export const RESUME_WRITING_MAX_BULLETS_PER_EXPERIENCE = 6;

const nullableConciseText = z.string().trim().max(300).nullable();
const exactText = z.string().min(1).max(4_000);
const stableId = z.string().trim().min(1).max(240);

const resumeWritingContextSchema = z
  .object({
    targetJobTitle: nullableConciseText,
    experience: z
      .array(
        z
          .object({
            id: stableId,
            roleTitle: nullableConciseText,
            description: z.string().max(4_000).nullable(),
            highlights: z
              .array(
                z
                  .object({
                    sourceFactId: stableId,
                    text: exactText,
                  })
                  .strict(),
              )
              .max(100),
          })
          .strict(),
      )
      .max(50),
    education: z
      .array(
        z
          .object({
            id: stableId,
            qualification: nullableConciseText,
            fieldOfStudy: nullableConciseText,
            statusLine: z.string().trim().min(1).max(300),
            highlights: z
              .array(
                z
                  .object({
                    sourceFactId: stableId,
                    text: exactText,
                  })
                  .strict(),
              )
              .max(100),
          })
          .strict(),
      )
      .max(50),
    skills: z
      .array(
        z.object({ id: stableId, name: exactText.max(160) }).strict(),
      )
      .max(100),
    licences: z
      .array(
        z
          .object({
            id: stableId,
            name: nullableConciseText,
            statusLine: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

const candidateEvidenceSourceSchema = z.enum([
  'skill',
  'experience',
  'experience-highlight',
  'education',
  'licence',
  'adaptive-answer',
  'project',
  'availability',
  'follow-up',
]);

const candidateEvidenceClassSchema = z.enum([
  'skill',
  'responsibility',
  'experience',
  'qualification',
  'certification',
  'availability',
  'general',
]);

const resumeWritingEvidenceSchema = z
  .object({
    id: stableId,
    source: candidateEvidenceSourceSchema,
    sourceId: stableId,
    parentSourceId: stableId.nullable(),
    text: exactText,
    normalizedTerms: z.array(z.string().trim().min(1).max(300)).max(80),
    evidenceClass: candidateEvidenceClassSchema,
    strength: z.enum(['direct', 'contextual']),
    confirmed: z.literal(true),
  })
  .strict();

const resumeWritingInputObjectSchema = z
  .object({
    analysis: jobAnalysisV1Schema,
    resume: resumeWritingContextSchema,
    candidateEvidence: z
      .array(resumeWritingEvidenceSchema)
      .max(RESUME_WRITING_MAX_EVIDENCE_ITEMS),
    confirmedFollowUpEvidence: z
      .array(resumeWritingEvidenceSchema)
      .max(RESUME_WRITING_MAX_EVIDENCE_ITEMS),
  })
  .strict();

type ParsedResumeWritingInput = z.infer<typeof resumeWritingInputObjectSchema>;

function comparable(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-AU');
}

function evidenceMatchesResumeContext(
  evidence: ParsedResumeWritingInput['candidateEvidence'][number],
  resume: ParsedResumeWritingInput['resume'],
  analysis: ParsedResumeWritingInput['analysis'],
): boolean {
  const text = comparable(evidence.text);

  switch (evidence.source) {
    case 'skill': {
      const skill = resume.skills.find((item) => item.id === evidence.sourceId);
      return Boolean(skill && comparable(skill.name) === text);
    }
    case 'experience':
    case 'project': {
      const experience = resume.experience.find(
        (item) => item.id === (evidence.parentSourceId ?? evidence.sourceId),
      );
      if (!experience) {
        return false;
      }
      if (evidence.parentSourceId) {
        return experience.highlights.some(
          (highlight) =>
            highlight.sourceFactId === evidence.sourceId &&
            comparable(highlight.text) === text,
        );
      }
      return [experience.roleTitle, experience.description]
        .filter((value): value is string => Boolean(value))
        .some((value) => comparable(value) === text);
    }
    case 'experience-highlight': {
      const experience = resume.experience.find(
        (item) => item.id === evidence.parentSourceId,
      );
      return Boolean(
        experience?.highlights.some(
          (highlight) =>
            highlight.sourceFactId === evidence.sourceId &&
            comparable(highlight.text) === text,
        ),
      );
    }
    case 'education': {
      const education = resume.education.find(
        (item) => item.id === (evidence.parentSourceId ?? evidence.sourceId),
      );
      if (!education) {
        return false;
      }
      if (evidence.parentSourceId) {
        return education.highlights.some(
          (highlight) =>
            highlight.sourceFactId === evidence.sourceId &&
            comparable(highlight.text) === text,
        );
      }
      return [education.qualification, education.fieldOfStudy]
        .filter((value): value is string => Boolean(value))
        .some((value) => comparable(value) === text);
    }
    case 'licence': {
      const licence = resume.licences.find(
        (item) => item.id === evidence.sourceId,
      );
      return Boolean(licence?.name && comparable(licence.name) === text);
    }
    case 'availability':
      // Availability is not resume copy in this checkpoint.
      return false;
    case 'adaptive-answer':
    case 'follow-up': {
      const labels = [
        ...analysis.requiredSkills.map((item) => item.name),
        ...analysis.preferredSkills.map((item) => item.name),
        ...analysis.responsibilities.map((item) => item.value),
        ...analysis.qualifications.map((item) => item.value),
        ...analysis.certifications.map((item) => item.value),
        ...analysis.softSkills.map((item) => item.value),
        ...analysis.experienceRequirements.map((item) => item.value),
        ...analysis.otherRequirements.map((item) => item.value),
      ];
      const terms = buildNormalizedTerms(evidence.text);
      return labels.some((label) => Boolean(findEquivalentMatch(label, terms)));
    }
  }
}

function canonicalEvidenceClass(
  evidence: ParsedResumeWritingInput['candidateEvidence'][number],
  resume: ParsedResumeWritingInput['resume'],
) {
  switch (evidence.source) {
    case 'skill':
      return 'skill' as const;
    case 'experience-highlight':
      return 'responsibility' as const;
    case 'experience':
    case 'project': {
      if (evidence.parentSourceId) {
        return 'responsibility' as const;
      }
      const entry = resume.experience.find(
        (item) => item.id === evidence.sourceId,
      );
      return entry?.roleTitle && comparable(entry.roleTitle) === comparable(evidence.text)
        ? ('experience' as const)
        : ('responsibility' as const);
    }
    case 'education':
      return evidence.parentSourceId
        ? ('responsibility' as const)
        : ('qualification' as const);
    case 'licence':
      return 'certification' as const;
    case 'availability':
      return 'availability' as const;
    case 'adaptive-answer':
    case 'follow-up':
      if (isFormalCredentialRequirementLabel(evidence.text)) {
        return 'certification' as const;
      }
      if (isFormalQualificationRequirementLabel(evidence.text)) {
        return 'qualification' as const;
      }
      if (isAvailabilityRequirementLabel(evidence.text)) {
        return 'availability' as const;
      }
      return 'skill' as const;
  }
}

function canonicaliseEvidence(
  evidence: ParsedResumeWritingInput['candidateEvidence'][number],
  resume: ParsedResumeWritingInput['resume'],
) {
  return {
    ...evidence,
    normalizedTerms: buildNormalizedTerms(evidence.text),
    evidenceClass: canonicalEvidenceClass(evidence, resume),
  };
}

export const resumeWritingInputSchema = resumeWritingInputObjectSchema.superRefine(
  (input, context) => {
    const ids = new Set<string>();

    for (const [section, evidenceItems] of [
      ['candidateEvidence', input.candidateEvidence],
      ['confirmedFollowUpEvidence', input.confirmedFollowUpEvidence],
    ] as const) {
      evidenceItems.forEach((evidence, index) => {
        if (ids.has(evidence.id)) {
          context.addIssue({
            code: 'custom',
            path: [section, index, 'id'],
            message: 'Evidence IDs must be unique',
          });
        }
        ids.add(evidence.id);

        const belongsInFollowUp = evidence.source === 'follow-up';
        if (
          (section === 'confirmedFollowUpEvidence') !== belongsInFollowUp
        ) {
          context.addIssue({
            code: 'custom',
            path: [section, index, 'source'],
            message: 'Evidence is in the wrong provenance section',
          });
        }

        if (evidence.strength !== 'direct') {
          context.addIssue({
            code: 'custom',
            path: [section, index, 'strength'],
            message: 'Only direct evidence may be used for resume writing',
          });
        }
      });
    }

    const experienceIds = new Set(
      input.resume.experience.map((experience) => experience.id),
    );
    if (experienceIds.size !== input.resume.experience.length) {
      context.addIssue({
        code: 'custom',
        path: ['resume', 'experience'],
        message: 'Experience IDs must be unique',
      });
    }

    for (const [section, evidenceItems] of [
      ['candidateEvidence', input.candidateEvidence],
      ['confirmedFollowUpEvidence', input.confirmedFollowUpEvidence],
    ] as const) {
      evidenceItems.forEach((evidence, index) => {
        if (
          !evidenceMatchesResumeContext(
            evidence,
            input.resume,
            input.analysis,
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: [section, index],
            message: 'Evidence does not match the supplied resume context',
          });
        }
      });
    }
  },
);

const generatedTextSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(RESUME_WRITING_MAX_TEXT_CHARACTERS),
    sourceRefs: z
      .array(stableId)
      .min(1)
      .max(12)
      .superRefine((refs, context) => {
        if (new Set(refs).size !== refs.length) {
          context.addIssue({
            code: 'custom',
            message: 'Source references must be unique',
          });
        }
      }),
  })
  .strict();

const generatedExperienceSchema = z
  .object({
    experienceId: stableId,
    bullets: z
      .array(generatedTextSchema)
      .max(RESUME_WRITING_MAX_BULLETS_PER_EXPERIENCE),
  })
  .strict();

const generatedResumeProposalObjectSchema = z
  .object({
    schemaVersion: z.literal(GENERATED_RESUME_PROPOSAL_SCHEMA_VERSION),
    summary: generatedTextSchema.nullable(),
    experience: z.array(generatedExperienceSchema).max(50),
    suggestedSkills: z.array(generatedTextSchema).max(60),
  })
  .strict();

export const generatedResumeProposalSchema =
  generatedResumeProposalObjectSchema.superRefine((proposal, context) => {
    const experienceIds = new Set<string>();
    proposal.experience.forEach((experience, index) => {
      if (experienceIds.has(experience.experienceId)) {
        context.addIssue({
          code: 'custom',
          path: ['experience', index, 'experienceId'],
          message: 'Each experience may appear only once',
        });
      }
      experienceIds.add(experience.experienceId);
    });
  });

export const generatedResumeProposalJsonSchema = z.toJSONSchema(
  generatedResumeProposalObjectSchema,
  { target: 'draft-07' },
);

export interface ResumeWritingValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class ResumeWritingValidationError extends Error {
  readonly code = 'INVALID_RESUME_WRITING_DATA' as const;
  readonly issues: readonly ResumeWritingValidationIssue[];

  constructor(
    message: string,
    issues: readonly ResumeWritingValidationIssue[],
  ) {
    super(message);
    this.name = 'ResumeWritingValidationError';
    this.issues = issues;
  }
}

function issuesFromZod(error: z.ZodError): ResumeWritingValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function parseResumeWritingInput(input: unknown): ResumeWritingInput {
  const result = resumeWritingInputSchema.safeParse(input);
  if (!result.success) {
    throw new ResumeWritingValidationError(
      'The resume-writing request is invalid.',
      issuesFromZod(result.error),
    );
  }
  return {
    ...result.data,
    candidateEvidence: result.data.candidateEvidence.map((evidence) =>
      canonicaliseEvidence(evidence, result.data.resume),
    ),
    confirmedFollowUpEvidence: result.data.confirmedFollowUpEvidence.map(
      (evidence) => canonicaliseEvidence(evidence, result.data.resume),
    ),
  };
}

export function parseGeneratedResumeProposal(
  input: unknown,
): GeneratedResumeProposal {
  const result = generatedResumeProposalSchema.safeParse(input);
  if (!result.success) {
    throw new ResumeWritingValidationError(
      'The resume-writing provider returned invalid structured output.',
      issuesFromZod(result.error),
    );
  }
  return result.data;
}

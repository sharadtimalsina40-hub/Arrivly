/**
 * The version of the employer-requirements extraction contract.
 *
 * This model deliberately contains no candidate facts. ResumeDraftV1 remains
 * the sole source of truth for claims about the person building the resume.
 */
export const JOB_ANALYSIS_SCHEMA_VERSION = 1 as const;

/** Bounds one analysis request to a predictable latency and cost envelope. */
export const JOB_AD_MAX_CHARACTERS = 20_000;

/** A concise extracted value paired with the exact source text that supports it. */
export interface EvidenceBackedJobAnalysisItem {
  value: string;
  evidenceText: string;
}

/** An employer requirement paired with the exact source text that supports it. */
export interface JobRequirement {
  name: string;
  evidenceText: string;
}

/**
 * Structured facts extracted from one job advertisement.
 *
 * `null` means the advertisement did not state a job title or employer. The
 * explicit nulls make the AI response contract unambiguous while empty arrays
 * mean that no grounded items were found for a section.
 */
export interface JobAnalysisV1 {
  readonly schemaVersion: typeof JOB_ANALYSIS_SCHEMA_VERSION;
  jobTitle: EvidenceBackedJobAnalysisItem | null;
  employer: EvidenceBackedJobAnalysisItem | null;
  requiredSkills: JobRequirement[];
  preferredSkills: JobRequirement[];
  responsibilities: EvidenceBackedJobAnalysisItem[];
  qualifications: EvidenceBackedJobAnalysisItem[];
  certifications: EvidenceBackedJobAnalysisItem[];
  softSkills: EvidenceBackedJobAnalysisItem[];
  keywords: EvidenceBackedJobAnalysisItem[];
  experienceRequirements: EvidenceBackedJobAnalysisItem[];
  otherRequirements: EvidenceBackedJobAnalysisItem[];
}

/** Current job-analysis model; future versions can extend this union. */
export type JobAnalysis = JobAnalysisV1;

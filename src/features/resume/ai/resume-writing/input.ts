import type { JobAnalysisV1 } from '../job-analysis/types';
import type {
  CandidateEvidence,
  CandidateEvidenceIndex,
} from '../../matching/types';
import type { ResumeViewModel } from '../../model/preview-model';
import type {
  ResumeWritingEvidence,
  ResumeWritingInput,
  ResumeWritingResumeContext,
} from './types';

function evidenceForWriting(
  evidence: CandidateEvidence,
): ResumeWritingEvidence | undefined {
  if (
    !evidence.confirmed ||
    evidence.polarity !== 'supports' ||
    evidence.strength !== 'direct' ||
    evidence.source === 'availability'
  ) {
    return undefined;
  }

  const evidenceText =
    evidence.source === 'follow-up' && evidence.contextLabel
      ? `Confirmed follow-up — ${evidence.contextLabel}: ${evidence.text}`
      : evidence.text;

  return {
    id: evidence.id,
    source: evidence.source,
    sourceId: evidence.sourceId,
    parentSourceId: evidence.parentSourceId ?? null,
    text: evidenceText,
    normalizedTerms: [...evidence.normalizedTerms],
    evidenceClass: evidence.evidenceClass,
    strength: evidence.strength,
    confirmed: true,
  };
}

function buildResumeContext(
  resume: ResumeViewModel,
): ResumeWritingResumeContext {
  return {
    targetJobTitle: resume.targetJobTitle ?? null,
    experience: (resume.sections.experience ?? []).map((experience) => ({
      id: experience.id,
      roleTitle: experience.roleTitle ?? null,
      description: experience.description ?? null,
      highlights: (experience.highlights ?? []).map((highlight) => ({
        sourceFactId: highlight.sourceFactId,
        text: highlight.text,
      })),
    })),
    education: (resume.sections.education ?? []).map((education) => ({
      id: education.id,
      qualification: education.qualification ?? null,
      fieldOfStudy: education.fieldOfStudy ?? null,
      statusLine: education.statusLine,
      highlights: (education.highlights ?? []).map((highlight) => ({
        sourceFactId: highlight.sourceFactId,
        text: highlight.text,
      })),
    })),
    skills: (resume.sections.skills ?? []).map((skill) => ({
      id: skill.id,
      name: skill.name,
    })),
    licences: (resume.sections.licences ?? []).map((licence) => ({
      id: licence.id,
      name: licence.name ?? null,
      statusLine: licence.statusLine,
    })),
  };
}

/**
 * Creates the least-data request sent to the server. Candidate name, contact
 * details, locations, employer names and dates are intentionally omitted.
 */
export function buildResumeWritingInput(
  analysis: JobAnalysisV1,
  resume: ResumeViewModel,
  evidenceIndex: CandidateEvidenceIndex,
): ResumeWritingInput {
  const allEvidence = evidenceIndex.items
    .map(evidenceForWriting)
    .filter((item): item is ResumeWritingEvidence => item !== undefined);

  return {
    analysis,
    resume: buildResumeContext(resume),
    candidateEvidence: allEvidence.filter(
      (evidence) => evidence.source !== 'follow-up',
    ),
    confirmedFollowUpEvidence: allEvidence.filter(
      (evidence) => evidence.source === 'follow-up',
    ),
  };
}

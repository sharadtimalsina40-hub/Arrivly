import type {
  EvidenceBackedJobAnalysisItem,
  JobAnalysisV1,
  JobRequirement,
} from '../ai/job-analysis/types';
import {
  findAustralianJurisdiction,
  findEquivalentMatch,
  hasControlledRelatedMatch,
  hasDurationQualifier,
  isAvailabilityRequirementLabel,
  isFormalCredentialRequirementLabel,
  isFormalQualificationRequirementLabel,
  isObviousNarrativeNegation,
  isObviousRelatedNarrativeNegation,
  normalizeMatchText,
} from './normalize';
import {
  JOB_MATCH_RESULT_SCHEMA_VERSION,
  type CandidateEvidence,
  type CandidateEvidenceIndex,
  type FollowUpCandidate,
  type JobMatchResult,
  type JobMatchSummary,
  type JobRequirementReference,
  type MatchStatusCounts,
  type MatchableJobAnalysisSection,
  type RequirementConfirmation,
  type RequirementConfirmationIndex,
  type RequirementImportance,
  type RequirementMatch,
  type RequirementType,
} from './types';

const MAX_EVIDENCE_REFS_PER_MATCH = 3;

const SENSITIVE_FOLLOW_UP_PATTERNS = [
  /\bage\b/,
  /\bdate of birth\b/,
  /\bgender\b/,
  /\bmarital status\b/,
  /\bphoto(?:graph)?\b/,
  /\btax file number\b/,
  /\btfn\b/,
  /\bpassport(?: number)?\b/,
] as const;

function requirementId(
  section: MatchableJobAnalysisSection,
  index: number,
  label: string,
): string {
  const slug = normalizeMatchText(label).replace(/\s+/g, '-').slice(0, 64);
  return `job-requirement:${section}:${index}:${slug || 'item'}`;
}

function requirementFromJobRequirement(
  section: 'requiredSkills' | 'preferredSkills',
  type: 'required-skill' | 'preferred-skill',
  importance: 'required' | 'preferred',
  item: JobRequirement,
  index: number,
): JobRequirementReference {
  return {
    id: requirementId(section, index, item.name),
    label: item.name,
    type,
    importance,
    employerEvidenceText: item.evidenceText,
    sourceSection: section,
    sourceIndex: index,
  };
}

function requirementFromEvidenceItem(
  section: Exclude<
    MatchableJobAnalysisSection,
    'requiredSkills' | 'preferredSkills'
  >,
  type: Exclude<RequirementType, 'required-skill' | 'preferred-skill'>,
  item: EvidenceBackedJobAnalysisItem,
  index: number,
): JobRequirementReference {
  return {
    id: requirementId(section, index, item.value),
    label: item.value,
    type,
    // JobAnalysisV1 does not retain priority for these sections. Guessing it
    // from prose would make follow-up generation look more certain than it is.
    importance: 'unspecified',
    employerEvidenceText: item.evidenceText,
    sourceSection: section,
    sourceIndex: index,
  };
}

export function buildJobRequirementReferences(
  analysis: JobAnalysisV1,
): readonly JobRequirementReference[] {
  return [
    ...analysis.requiredSkills.map((item, index) =>
      requirementFromJobRequirement(
        'requiredSkills',
        'required-skill',
        'required',
        item,
        index,
      ),
    ),
    ...analysis.preferredSkills.map((item, index) =>
      requirementFromJobRequirement(
        'preferredSkills',
        'preferred-skill',
        'preferred',
        item,
        index,
      ),
    ),
    ...analysis.responsibilities.map((item, index) =>
      requirementFromEvidenceItem(
        'responsibilities',
        'responsibility',
        item,
        index,
      ),
    ),
    ...analysis.qualifications.map((item, index) =>
      requirementFromEvidenceItem(
        'qualifications',
        'qualification',
        item,
        index,
      ),
    ),
    ...analysis.certifications.map((item, index) =>
      requirementFromEvidenceItem(
        'certifications',
        'certification',
        item,
        index,
      ),
    ),
    ...analysis.softSkills.map((item, index) =>
      requirementFromEvidenceItem(
        'softSkills',
        'soft-skill',
        item,
        index,
      ),
    ),
    ...analysis.experienceRequirements.map((item, index) =>
      requirementFromEvidenceItem(
        'experienceRequirements',
        'experience',
        item,
        index,
      ),
    ),
    ...analysis.otherRequirements.map((item, index) =>
      requirementFromEvidenceItem(
        'otherRequirements',
        'other-requirement',
        item,
        index,
      ),
    ),
  ];
}

function isCredentialRequirement(
  requirement: JobRequirementReference,
): boolean {
  return (
    requirement.type === 'certification' ||
    isFormalCredentialRequirementLabel(requirement.label)
  );
}

function isFormalQualificationRequirement(
  requirement: JobRequirementReference,
): boolean {
  if (requirement.type === 'qualification') {
    return true;
  }

  return isFormalQualificationRequirementLabel(requirement.label);
}

function isAvailabilityRequirement(
  requirement: JobRequirementReference,
): boolean {
  return isAvailabilityRequirementLabel(requirement.label);
}

function canDirectlySupport(
  requirement: JobRequirementReference,
  evidence: CandidateEvidence,
): boolean {
  if (isCredentialRequirement(requirement)) {
    return evidence.evidenceClass === 'certification';
  }

  if (isFormalQualificationRequirement(requirement)) {
    return evidence.evidenceClass === 'qualification';
  }

  if (isAvailabilityRequirement(requirement)) {
    return evidence.evidenceClass === 'availability';
  }

  switch (requirement.type) {
    case 'qualification':
      return false;
    case 'responsibility':
      return (
        evidence.evidenceClass === 'responsibility' ||
        evidence.evidenceClass === 'experience'
      );
    case 'experience':
      return (
        evidence.evidenceClass === 'experience' ||
        evidence.evidenceClass === 'responsibility'
      );
    case 'soft-skill':
      return (
        evidence.source === 'skill' ||
        (evidence.source === 'follow-up' &&
          evidence.evidenceClass === 'skill')
      );
    case 'required-skill':
    case 'preferred-skill':
      return (
        evidence.evidenceClass === 'skill' ||
        evidence.evidenceClass === 'responsibility' ||
        evidence.evidenceClass === 'experience' ||
        evidence.evidenceClass === 'general'
      );
    case 'other-requirement':
      return true;
  }
}

function canProvideRelatedEvidence(
  requirement: JobRequirementReference,
  evidence: CandidateEvidence,
): boolean {
  if (isCredentialRequirement(requirement)) {
    return evidence.evidenceClass === 'certification';
  }

  if (isFormalQualificationRequirement(requirement)) {
    return evidence.evidenceClass === 'qualification';
  }

  if (isAvailabilityRequirement(requirement)) {
    return evidence.evidenceClass === 'availability';
  }

  switch (requirement.type) {
    case 'qualification':
      return false;
    case 'responsibility':
    case 'experience':
      return (
        evidence.evidenceClass === 'experience' ||
        evidence.evidenceClass === 'responsibility' ||
        evidence.evidenceClass === 'skill'
      );
    case 'soft-skill':
      return (
        evidence.evidenceClass === 'skill' ||
        evidence.evidenceClass === 'experience' ||
        evidence.evidenceClass === 'responsibility' ||
        evidence.evidenceClass === 'general'
      );
    case 'required-skill':
    case 'preferred-skill':
      return evidence.evidenceClass !== 'availability';
    case 'other-requirement':
      return true;
  }
}

function hasJurisdictionConflict(
  requirement: JobRequirementReference,
  evidence: CandidateEvidence,
): boolean {
  if (!isCredentialRequirement(requirement)) {
    return false;
  }

  const requiredJurisdiction = findAustralianJurisdiction(
    `${requirement.label} ${requirement.employerEvidenceText}`,
  );

  if (!requiredJurisdiction) {
    return false;
  }

  const candidateJurisdiction = findAustralianJurisdiction(
    `${evidence.metadata?.jurisdiction ?? ''} ${evidence.text}`,
  );

  return candidateJurisdiction !== requiredJurisdiction;
}

function toNonEmptyRefs(
  evidence: readonly CandidateEvidence[],
): readonly [string, ...string[]] {
  const refs = Array.from(new Set(evidence.map((item) => item.id))).slice(
    0,
    MAX_EVIDENCE_REFS_PER_MATCH,
  );

  if (refs.length === 0) {
    throw new Error('A resolved requirement match must reference evidence.');
  }

  return refs as [string, ...string[]];
}

function matchRequirement(
  requirement: JobRequirementReference,
  evidenceItems: readonly CandidateEvidence[],
  confirmations: readonly RequirementConfirmation[],
): RequirementMatch {
  const directPositive: Array<{
    evidence: CandidateEvidence;
    basis: 'exact' | 'controlled-alias';
  }> = [];
  const contextualPositive: CandidateEvidence[] = [];
  const controlledRelated: CandidateEvidence[] = [];
  const explicitNegative: CandidateEvidence[] = [];
  const unsafeNarrative: CandidateEvidence[] = [];
  const explicitFollowUpDeclines = confirmations.filter((confirmation) =>
    confirmation.requirementIds.includes(requirement.id),
  );

  for (const evidence of evidenceItems) {
    const equivalentBasis = findEquivalentMatch(
      requirement.label,
      evidence.normalizedTerms,
    );

    if (equivalentBasis) {
      if (evidence.polarity === 'denies') {
        if (canDirectlySupport(requirement, evidence)) {
          explicitNegative.push(evidence);
        }
        continue;
      }

      if (
        isObviousNarrativeNegation(evidence.text, requirement.label)
      ) {
        unsafeNarrative.push(evidence);
        continue;
      }

      if (!canDirectlySupport(requirement, evidence)) {
        if (canProvideRelatedEvidence(requirement, evidence)) {
          contextualPositive.push(evidence);
        }
        continue;
      }

      const durationIsOnlyImplied =
        hasDurationQualifier(requirement.label) &&
        equivalentBasis !== 'exact';

      if (
        evidence.strength === 'contextual' ||
        durationIsOnlyImplied ||
        hasJurisdictionConflict(requirement, evidence)
      ) {
        contextualPositive.push(evidence);
      } else {
        directPositive.push({ evidence, basis: equivalentBasis });
      }
      continue;
    }

    if (
      evidence.polarity === 'supports' &&
      canProvideRelatedEvidence(requirement, evidence) &&
      hasControlledRelatedMatch(requirement.label, evidence.normalizedTerms)
    ) {
      if (
        isObviousRelatedNarrativeNegation(evidence.text, requirement.label)
      ) {
        unsafeNarrative.push(evidence);
        continue;
      }

      controlledRelated.push(evidence);
    }
  }

  const anyPositiveEvidence = [
    ...directPositive.map((item) => item.evidence),
    ...contextualPositive,
    ...controlledRelated,
  ];

  if (
    explicitFollowUpDeclines.length > 0 &&
    anyPositiveEvidence.length > 0
  ) {
    return {
      requirement,
      status: 'unresolved',
      basis: 'conflict',
      evidenceRefs: Array.from(
        new Set(anyPositiveEvidence.map((item) => item.id)),
      ).slice(0, MAX_EVIDENCE_REFS_PER_MATCH),
      confirmationRefs: explicitFollowUpDeclines.map((item) => item.id),
      explanation:
        'Confirmed candidate information conflicts with a follow-up answer, so this requirement needs clarification.',
    };
  }

  if (directPositive.length > 0 && explicitNegative.length > 0) {
    return {
      requirement,
      status: 'unresolved',
      basis: 'conflict',
      evidenceRefs: [
        ...toNonEmptyRefs(directPositive.map((item) => item.evidence)),
        ...toNonEmptyRefs(explicitNegative),
      ].slice(0, MAX_EVIDENCE_REFS_PER_MATCH),
      confirmationRefs: [],
      explanation:
        'Confirmed candidate information conflicts, so this requirement needs clarification.',
    };
  }

  if (directPositive.length > 0) {
    return {
      requirement,
      status: 'matched',
      basis: directPositive.some((item) => item.basis === 'exact')
        ? 'exact'
        : 'controlled-alias',
      evidenceRefs: toNonEmptyRefs(
        directPositive.map((item) => item.evidence),
      ),
      confirmationRefs: [],
      explanation:
        'Confirmed candidate information contains this requirement or a controlled equivalent.',
    };
  }

  if (explicitNegative.length > 0) {
    return {
      requirement,
      status: 'confirmed-missing',
      basis: 'explicit-negative',
      evidenceRefs: toNonEmptyRefs(explicitNegative),
      confirmationRefs: explicitFollowUpDeclines.map((item) => item.id),
      explanation:
        'A confirmed candidate answer explicitly says this is not currently held or used.',
    };
  }

  if (explicitFollowUpDeclines.length > 0) {
    return {
      requirement,
      status: 'confirmed-missing',
      basis: 'follow-up-decline',
      evidenceRefs: [],
      confirmationRefs: explicitFollowUpDeclines.map((item) => item.id),
      explanation:
        'A job-specific follow-up answer explicitly says this is not currently held or used.',
    };
  }

  if (contextualPositive.length > 0) {
    return {
      requirement,
      status: 'related',
      basis: hasDurationQualifier(requirement.label)
        ? 'unsafe-to-infer'
        : 'context-only',
      evidenceRefs: toNonEmptyRefs(contextualPositive),
      confirmationRefs: [],
      explanation:
        'Related candidate information exists, but it is not strong enough to confirm an exact match.',
    };
  }

  if (controlledRelated.length > 0) {
    return {
      requirement,
      status: 'related',
      basis: 'controlled-related',
      evidenceRefs: toNonEmptyRefs(controlledRelated),
      confirmationRefs: [],
      explanation:
        'A transparent related-evidence rule found relevant candidate information without treating it as equivalent.',
    };
  }

  if (unsafeNarrative.length > 0) {
    return {
      requirement,
      status: 'unresolved',
      basis: 'unsafe-to-infer',
      evidenceRefs: unsafeNarrative.map((item) => item.id).slice(
        0,
        MAX_EVIDENCE_REFS_PER_MATCH,
      ),
      confirmationRefs: [],
      explanation:
        'The term appears in candidate narrative, but its wording is negative or unsafe to interpret automatically.',
    };
  }

  return {
    requirement,
    status: 'unresolved',
    basis: 'no-evidence',
    evidenceRefs: [],
    confirmationRefs: [],
    explanation:
      'No matching candidate information is currently recorded. This does not mean the candidate lacks it.',
  };
}

function emptyStatusCounts(): MatchStatusCounts {
  return {
    total: 0,
    matched: 0,
    related: 0,
    unresolved: 0,
    confirmedMissing: 0,
  };
}

function buildSummary(matches: readonly RequirementMatch[]): JobMatchSummary {
  const mutableSummary: Record<RequirementImportance, MatchStatusCounts> = {
    required: emptyStatusCounts(),
    preferred: emptyStatusCounts(),
    unspecified: emptyStatusCounts(),
  };

  for (const match of matches) {
    const counts = mutableSummary[match.requirement.importance];
    const nextCounts: MatchStatusCounts = {
      ...counts,
      total: counts.total + 1,
      matched: counts.matched + (match.status === 'matched' ? 1 : 0),
      related: counts.related + (match.status === 'related' ? 1 : 0),
      unresolved: counts.unresolved + (match.status === 'unresolved' ? 1 : 0),
      confirmedMissing:
        counts.confirmedMissing +
        (match.status === 'confirmed-missing' ? 1 : 0),
    };
    mutableSummary[match.requirement.importance] = nextCounts;
  }

  return mutableSummary;
}

function isSensitiveFollowUp(requirement: string): boolean {
  const normalized = normalizeMatchText(requirement);
  return SENSITIVE_FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized));
}

function followUpQuestion(match: RequirementMatch): string {
  const requirement = match.requirement.label.replace(/[.?!]+$/g, '').trim();

  if (
    match.requirement.type === 'certification' ||
    isFormalCredentialRequirementLabel(requirement)
  ) {
    return `Do you currently hold a valid ${requirement}?`;
  }

  if (isFormalQualificationRequirement(match.requirement)) {
    return `Do you hold, or are you currently studying toward, ${requirement}?`;
  }

  if (match.requirement.type === 'experience') {
    return `Do you have experience that directly supports ${requirement}?`;
  }

  return `Have you used ${requirement} in work, study, volunteering or personal projects?`;
}

export function buildFollowUpCandidates(
  matches: readonly RequirementMatch[],
): readonly FollowUpCandidate[] {
  return matches
    .filter(
      (match) =>
        match.status === 'unresolved' &&
        match.requirement.importance === 'required' &&
        !isSensitiveFollowUp(match.requirement.label),
    )
    .map((match) => ({
      id: `follow-up:${match.requirement.id}`,
      requirementId: match.requirement.id,
      requirement: match.requirement.label,
      requirementType: match.requirement.type,
      question: followUpQuestion(match),
      reason:
        'This required employer criterion has no confirmed matching candidate evidence yet.',
    }));
}

/** Pure deterministic matcher. Neither input is modified. */
export function matchJobRequirements(
  analysis: JobAnalysisV1,
  evidenceIndex: CandidateEvidenceIndex,
  confirmationIndex: RequirementConfirmationIndex = { items: [] },
): JobMatchResult {
  const requirements = buildJobRequirementReferences(analysis);
  const matches = requirements.map((requirement) =>
    matchRequirement(
      requirement,
      evidenceIndex.items,
      confirmationIndex.items,
    ),
  );

  return {
    schemaVersion: JOB_MATCH_RESULT_SCHEMA_VERSION,
    evidenceIndex,
    confirmationIndex,
    matches,
    summary: buildSummary(matches),
    followUpCandidates: buildFollowUpCandidates(matches),
  };
}

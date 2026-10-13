import {
  buildNormalizedTerms,
  findEquivalentMatch,
  isFormalCredentialRequirementLabel,
  isFormalQualificationRequirementLabel,
  isObviousNarrativeNegation,
  normalizeMatchText,
} from '../../matching/normalize';
import { parseGeneratedResumeProposal, parseResumeWritingInput } from './schema';
import type {
  GeneratedExperience,
  GeneratedResumeProposal,
  GeneratedText,
  ResumeWritingEvidence,
  ResumeWritingInput,
  ResumeWritingRejection,
  ResumeWritingRejectionCode,
  ValidatedResumeWritingResult,
} from './types';

/**
 * Words that may safely be introduced while rewriting a candidate's fact.
 * This is deliberately finite: unfamiliar content words are withheld for
 * review rather than being treated as harmless prose.
 */
const SAFE_CONNECTIVE_TERMS = new Set(
  normalizeMatchText(`
    a an and as at by for from in into of on or the to with within through
    across while who that which including include includes
    professional practical relevant demonstrated confirmed current technical
    skill skills experience experiences responsibility responsibilities
    work working knowledge capability capabilities task tasks day daily
    workplace role roles
  `)
    .split(' ')
    .filter(Boolean),
);

/**
 * Controlled paraphrase groups. A generated word is allowed only when the
 * cited evidence contains another word from that same reviewed group.
 */
const CONTROLLED_REWRITE_GROUPS: readonly ReadonlySet<string>[] = [
  'help helped helping assist assisted assisting',
  'build built building develop developed developing create created creating',
  'use used using utilise utilised utilising',
  'organise organised organising organize organized organizing',
  'maintain maintained maintaining',
  'resolve resolved resolving',
  'customer customers product products enquiry enquiries inquiry inquiries service services',
  'put stock shelf shelves replenish replenished replenishing restock restocked restocking',
].map(
  (group) =>
    new Set(normalizeMatchText(group).split(' ').filter(Boolean)),
);

const STOCK_CONTEXT_TRIGGERS = new Set([
  'put',
  'shelf',
  'shelves',
  'replenish',
  'replenished',
  'replenishing',
  'restock',
  'restocked',
  'restocking',
]);

const STOCK_CONTEXT_REWRITES = new Set([
  ...STOCK_CONTEXT_TRIGGERS,
  'stock',
  'maintain',
  'maintained',
  'maintaining',
  'organise',
  'organised',
  'organising',
  'organize',
  'organized',
  'organizing',
  'display',
  'displays',
]);

const CLAIM_ACTION_TERMS = new Set(
  normalizeMatchText(`
    help helped helping assist assisted assisting support supported supporting
    serve served serving provide provided providing respond responded responding
    build built building develop developed developing create created creating
    design designed designing deploy deployed deploying implement implemented
    implementing test tested testing integrate integrated integrating use used
    using utilise utilised utilising apply applied applying organise organised
    organizing organized maintain maintained maintaining resolve resolved
    resolving replenish replenished replenishing restock restocked restocking
    manage managed managing coordinate coordinated coordinating communicate
    communicated communicating collaborate collaborated collaborating monitor
    monitored monitoring operate operated operating handle handled handling
    process processed processing prepare prepared preparing complete completed
    completing perform performed performing ensure ensured ensuring
  `)
    .split(' ')
    .filter(Boolean),
);

function hasStockContext(text: string): boolean {
  return normalizeMatchText(text)
    .split(' ')
    .some((token) => STOCK_CONTEXT_TRIGGERS.has(token));
}

function canonicalClaimSequence(
  text: string,
  contextualSourceText = text,
): readonly string[] {
  const stockContext = hasStockContext(contextualSourceText);
  const sequence = normalizeMatchText(text)
    .split(' ')
    .filter(
      (token) =>
        Boolean(token) &&
        !SAFE_CONNECTIVE_TERMS.has(token),
    )
    .map((token) => {
      if (stockContext && STOCK_CONTEXT_REWRITES.has(token)) {
        return 'stock-context-rewrite';
      }
      const groupIndex = CONTROLLED_REWRITE_GROUPS.findIndex((group) =>
        group.has(token),
      );
      return groupIndex < 0 ? token : `rewrite-group-${groupIndex}`;
    });

  return sequence.filter(
    (token, index) => token !== sequence[index - 1],
  );
}

function isOrderedSubsequence(
  candidate: readonly string[],
  source: readonly string[],
): boolean {
  let sourceIndex = 0;
  for (const token of candidate) {
    while (sourceIndex < source.length && source[sourceIndex] !== token) {
      sourceIndex += 1;
    }
    if (sourceIndex >= source.length) {
      return false;
    }
    sourceIndex += 1;
  }
  return true;
}

function evidenceGroundsActionSequence(
  text: string,
  evidence: ResumeWritingEvidence,
): boolean {
  const candidate = canonicalClaimSequence(text, evidence.text);
  return (
    candidate.length > 0 &&
    isOrderedSubsequence(candidate, canonicalClaimSequence(evidence.text))
  );
}

const UNSUPPORTED_CLAIM_PHRASES = [
  'advanced',
  'award winning',
  'best in class',
  'exceptional',
  'expert',
  'extensive experience',
  'highly experienced',
  'leadership',
  'proven track record',
  'senior',
  'strong track record',
  'australian experience',
] as const;

const NUMBER_WORDS = new Set([
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'hundred',
  'thousand',
  'million',
  'percent',
  'percentage',
]);

interface GroundingContext {
  readonly input: ResumeWritingInput;
  readonly evidenceById: ReadonlyMap<string, ResumeWritingEvidence>;
  readonly analysisLabels: readonly string[];
  readonly experienceIds: ReadonlySet<string>;
}

function analysisLabels(input: ResumeWritingInput): readonly string[] {
  const analysis = input.analysis;
  return [
    analysis.jobTitle?.value,
    analysis.employer?.value,
    ...analysis.requiredSkills.map((item) => item.name),
    ...analysis.preferredSkills.map((item) => item.name),
    ...analysis.responsibilities.map((item) => item.value),
    ...analysis.qualifications.map((item) => item.value),
    ...analysis.certifications.map((item) => item.value),
    ...analysis.softSkills.map((item) => item.value),
    ...analysis.keywords.map((item) => item.value),
    ...analysis.experienceRequirements.map((item) => item.value),
    ...analysis.otherRequirements.map((item) => item.value),
  ].filter((value): value is string => Boolean(value?.trim()));
}

function buildContext(input: ResumeWritingInput): GroundingContext {
  const evidence = [
    ...input.candidateEvidence,
    ...input.confirmedFollowUpEvidence,
  ];

  return {
    input,
    evidenceById: new Map(evidence.map((item) => [item.id, item] as const)),
    analysisLabels: analysisLabels(input),
    experienceIds: new Set(
      input.resume.experience.map((experience) => experience.id),
    ),
  };
}

function firstDuplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
  }

  return undefined;
}

function sourceTokens(evidence: readonly ResumeWritingEvidence[]): Set<string> {
  const tokens = new Set<string>();

  for (const item of evidence) {
    for (const value of [item.text, ...item.normalizedTerms]) {
      normalizeMatchText(value)
        .split(' ')
        .filter(Boolean)
        .forEach((token) => tokens.add(token));
    }
  }

  return tokens;
}

function sourceContainsNumber(
  token: string,
  evidence: readonly ResumeWritingEvidence[],
): boolean {
  const comparable = normalizeMatchText(token);
  return evidence.some((item) =>
    containsToken(normalizeMatchText(item.text), comparable),
  );
}

function containsToken(haystack: string, needle: string): boolean {
  return Boolean(needle) && ` ${haystack} `.includes(` ${needle} `);
}

function referencedEvidence(
  statement: GeneratedText,
  context: GroundingContext,
):
  | { readonly evidence: readonly ResumeWritingEvidence[] }
  | { readonly rejection: ResumeWritingRejectionCode } {
  if (firstDuplicate(statement.sourceRefs)) {
    return { rejection: 'duplicate-source-ref' };
  }

  const resolved: ResumeWritingEvidence[] = [];
  for (const sourceRef of statement.sourceRefs) {
    const evidence = context.evidenceById.get(sourceRef);
    if (!evidence) {
      return { rejection: 'unknown-source-ref' };
    }
    resolved.push(evidence);
  }

  return { evidence: resolved };
}

function evidenceBelongsToExperience(
  evidence: ResumeWritingEvidence,
  experienceId: string,
): boolean {
  if (
    evidence.source !== 'experience' &&
    evidence.source !== 'experience-highlight' &&
    evidence.source !== 'project'
  ) {
    return false;
  }

  return (
    evidence.sourceId === experienceId ||
    evidence.parentSourceId === experienceId
  );
}

function introducesUnsupportedNumbers(
  text: string,
  evidence: readonly ResumeWritingEvidence[],
): boolean {
  const rawNumbers = text.match(/(?:[$£€]\s*)?\d[\d,.]*(?:\s*%|\s*per\s*cent)?/gi) ?? [];
  if (rawNumbers.some((value) => !sourceContainsNumber(value, evidence))) {
    return true;
  }

  const words = normalizeMatchText(text).split(' ');
  return words.some(
    (word) =>
      NUMBER_WORDS.has(word) && !sourceContainsNumber(word, evidence),
  );
}

function introducesUnsupportedClaimLanguage(
  text: string,
  evidence: readonly ResumeWritingEvidence[],
): boolean {
  const comparableText = normalizeMatchText(text);
  const comparableEvidence = normalizeMatchText(
    evidence.map((item) => item.text).join(' '),
  );

  return UNSUPPORTED_CLAIM_PHRASES.some(
    (phrase) =>
      containsToken(comparableText, normalizeMatchText(phrase)) &&
      !containsToken(comparableEvidence, normalizeMatchText(phrase)),
  );
}

function introducesUnsupportedFormalClaim(
  text: string,
  evidence: readonly ResumeWritingEvidence[],
): boolean {
  const formalClaim =
    isFormalCredentialRequirementLabel(text) ||
    isFormalQualificationRequirementLabel(text);

  if (!formalClaim) {
    return false;
  }

  return !evidence.some((item) => {
    if (
      item.evidenceClass !== 'certification' &&
      item.evidenceClass !== 'qualification'
    ) {
      return false;
    }

    return Boolean(findEquivalentMatch(text, item.normalizedTerms));
  });
}

function introducesUnsupportedJobTerm(
  text: string,
  evidence: readonly ResumeWritingEvidence[],
  context: GroundingContext,
): boolean {
  const comparableText = normalizeMatchText(text);
  return context.analysisLabels.some((label) => {
    const normalizedLabel = normalizeMatchText(label);
    if (!containsToken(comparableText, normalizedLabel)) {
      return false;
    }

    return !evidence.some(
      (item) =>
        Boolean(
          findEquivalentMatch(label, [
            ...item.normalizedTerms,
            ...buildNormalizedTerms(item.text),
          ]),
        ) && !isObviousNarrativeNegation(item.text, label),
    );
  });
}

function introducesUnsupportedTerms(
  text: string,
  evidence: readonly ResumeWritingEvidence[],
): boolean {
  const allowed = sourceTokens(evidence);
  const tokens = normalizeMatchText(text).split(' ').filter(Boolean);

  return tokens.some((token) => {
    if (/^\d+$/.test(token)) {
      return false;
    }

    if (SAFE_CONNECTIVE_TERMS.has(token)) {
      return false;
    }

    const controlledRewrite = CONTROLLED_REWRITE_GROUPS.some(
      (group) =>
        group.has(token) && Array.from(group).some((term) => allowed.has(term)),
    );
    const stockContextRewrite =
      STOCK_CONTEXT_REWRITES.has(token) &&
      Array.from(STOCK_CONTEXT_TRIGGERS).some((term) => allowed.has(term));

    if (!allowed.has(token) && !controlledRewrite && !stockContextRewrite) {
      return true;
    }

    if ((controlledRewrite || stockContextRewrite) && !allowed.has(token)) {
      return false;
    }

    const supportingItems = evidence.filter((item) =>
      [item.text, ...item.normalizedTerms].some((value) =>
        containsToken(normalizeMatchText(value), token),
      ),
    );

    return (
      supportingItems.length > 0 &&
      supportingItems.every((item) =>
        isObviousNarrativeNegation(item.text, token),
      )
    );
  });
}

function validateStatement(
  statement: GeneratedText,
  context: GroundingContext,
  options: {
    readonly experienceId?: string;
    readonly skillSuggestion?: boolean;
  } = {},
):
  | { readonly statement: GeneratedText }
  | { readonly code: ResumeWritingRejectionCode } {
  const resolution = referencedEvidence(statement, context);
  if ('rejection' in resolution) {
    return { code: resolution.rejection };
  }

  const evidence = resolution.evidence;

  if (
    options.experienceId &&
    !evidence.every((item) =>
      evidenceBelongsToExperience(item, options.experienceId as string),
    )
  ) {
    return { code: 'wrong-experience' };
  }

  if (introducesUnsupportedNumbers(statement.text, evidence)) {
    return { code: 'unsupported-number' };
  }

  if (introducesUnsupportedClaimLanguage(statement.text, evidence)) {
    return { code: 'unsupported-claim-language' };
  }

  if (introducesUnsupportedFormalClaim(statement.text, evidence)) {
    return { code: 'unsupported-formal-claim' };
  }

  if (introducesUnsupportedJobTerm(statement.text, evidence, context)) {
    return { code: 'unsupported-requirement' };
  }

  if (options.skillSuggestion) {
    const supportedSkill = evidence.some(
      (item) =>
        item.evidenceClass === 'skill' &&
        Boolean(findEquivalentMatch(statement.text, item.normalizedTerms)),
    );

    if (!supportedSkill) {
      return { code: 'invalid-skill-suggestion' };
    }
  }

  const isActionful = normalizeMatchText(statement.text)
    .split(' ')
    .some((token) => CLAIM_ACTION_TERMS.has(token));
  const normalizedStatementTokens = normalizeMatchText(statement.text).split(' ');
  const isQuantified =
    /(?:[$£€]\s*)?\d[\d,.]*(?:\s*%|\s*per\s*cent)?/i.test(
      statement.text,
    ) ||
    normalizedStatementTokens.some(
      (token) =>
        NUMBER_WORDS.has(token) ||
        ['year', 'years', 'month', 'months', 'week', 'weeks'].includes(token),
    );

  if (
    (isActionful || isQuantified) &&
    !evidence.some((item) =>
      evidenceGroundsActionSequence(statement.text, item),
    )
  ) {
    return { code: 'cross-evidence-recombination' };
  }

  if (introducesUnsupportedTerms(statement.text, evidence)) {
    return { code: 'unsupported-term' };
  }

  return {
    statement: {
      text: statement.text,
      sourceRefs: [...statement.sourceRefs],
    },
  };
}

function reject(
  rejections: ResumeWritingRejection[],
  path: string,
  code: ResumeWritingRejectionCode,
) {
  rejections.push({ path, code });
}

/**
 * Structural validation is followed by claim-level provenance validation.
 * Rejected provider text is never returned, logged or rendered.
 */
export function validateGeneratedResumeProposal(
  untrustedProposal: unknown,
  untrustedInput: unknown,
): ValidatedResumeWritingResult {
  const input = parseResumeWritingInput(untrustedInput);
  const proposal = parseGeneratedResumeProposal(untrustedProposal);
  const context = buildContext(input);
  const rejections: ResumeWritingRejection[] = [];

  let summary: GeneratedText | null = null;
  if (proposal.summary) {
    const result = validateStatement(proposal.summary, context);
    if ('statement' in result) {
      summary = result.statement;
    } else {
      reject(rejections, 'summary', result.code);
    }
  }

  const experience: GeneratedExperience[] = [];
  proposal.experience.forEach((generatedExperience, experienceIndex) => {
    if (!context.experienceIds.has(generatedExperience.experienceId)) {
      generatedExperience.bullets.forEach((_, bulletIndex) =>
        reject(
          rejections,
          `experience.${experienceIndex}.bullets.${bulletIndex}`,
          'wrong-experience',
        ),
      );
      return;
    }

    const bullets = generatedExperience.bullets.flatMap(
      (bullet, bulletIndex) => {
        const result = validateStatement(bullet, context, {
          experienceId: generatedExperience.experienceId,
        });

        if ('statement' in result) {
          return [result.statement];
        }

        reject(
          rejections,
          `experience.${experienceIndex}.bullets.${bulletIndex}`,
          result.code,
        );
        return [];
      },
    );

    if (bullets.length > 0) {
      experience.push({
        experienceId: generatedExperience.experienceId,
        bullets,
      });
    }
  });

  const suggestedSkills = proposal.suggestedSkills.flatMap(
    (skill, skillIndex) => {
      const result = validateStatement(skill, context, {
        skillSuggestion: true,
      });

      if ('statement' in result) {
        return [result.statement];
      }

      reject(rejections, `suggestedSkills.${skillIndex}`, result.code);
      return [];
    },
  );

  const safeProposal: GeneratedResumeProposal = {
    schemaVersion: proposal.schemaVersion,
    summary,
    experience,
    suggestedSkills,
  };

  return {
    proposal: safeProposal,
    rejectedStatements: rejections.length,
  };
}

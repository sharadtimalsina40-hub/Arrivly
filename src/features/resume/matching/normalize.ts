/**
 * Explicit equivalences used by the deterministic matcher.
 *
 * These are intentionally small and reviewable. Items under one key may be
 * treated as the same term; relationships such as AWS -> cloud platforms live
 * in the separate related-evidence registry below.
 */
export const CONTROLLED_ALIAS_REGISTRY = {
  nodejs: ['Node.js', 'NodeJS', 'node js'],
  postgresql: ['PostgreSQL', 'Postgres'],
  aws: ['AWS', 'Amazon Web Services'],
  azure: ['Azure', 'Microsoft Azure'],
  gcp: ['GCP', 'Google Cloud Platform'],
  'ci-cd': [
    'CI/CD',
    'ci cd',
    'continuous integration',
    'continuous delivery',
    'continuous integration and continuous delivery',
  ],
  pos: [
    'POS',
    'POS experience',
    'POS system',
    'POS systems',
    'point of sale',
    'point-of-sale',
    'point of sale system',
    'point of sale systems',
    'cash register',
    'cash register experience',
  ],
  'rest-api': ['REST API', 'REST APIs', 'RESTful API', 'RESTful APIs'],
  git: ['Git'],
  'github-actions': ['GitHub Actions'],
  jenkins: ['Jenkins'],
  'gitlab-ci': ['GitLab CI'],
  circleci: ['CircleCI'],
  'cloud-platforms': ['cloud platform', 'cloud platforms'],
  'customer-service': ['customer service'],
  'customer-interaction': [
    'helped customers',
    'assisted customers',
    'served customers',
    'assisted shoppers',
    'resolved customer enquiries',
    'worked directly with customers',
  ],
  communication: ['communication', 'written communication', 'verbal communication'],
  teamwork: ['teamwork', 'team work'],
  'team-collaboration': [
    'collaborated with',
    'worked in a team',
    'worked with a team',
  ],
  'stock-replenishment': ['stock replenishment', 'replenishing stock'],
  'shelf-restocking': [
    'refilled shelves',
    'restocked shelves',
    'replenished shelves',
  ],
  'weekend-availability': [
    'weekend availability',
    'available weekends',
    'available on weekends',
  ],
  'forklift-licence': [
    'forklift licence',
    'forklift license',
    'LF licence',
    'LF license',
  ],
  rsa: ['RSA', 'Responsible Service of Alcohol'],
  'driver-licence': ['driver licence', 'driver license', "driver's licence"],
  'white-card': ['White Card', 'construction induction card'],
  'first-aid': ['first aid', 'first aid certificate'],
  cpr: ['CPR', 'cardiopulmonary resuscitation'],
  'working-with-children': [
    'Working With Children Check',
    'WWCC',
  ],
  'ndis-worker-screening': [
    'NDIS Worker Screening Check',
    'NDIS worker screening',
  ],
  cpa: ['CPA', 'CPA Australia', 'Certified Practising Accountant'],
  excel: ['Excel', 'Microsoft Excel'],
  myob: ['MYOB'],
  xero: ['Xero'],
  reconciliation: [
    'reconciliation',
    'reconciliations',
    'bank reconciliation',
    'bank reconciliations',
  ],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** Broader relationships. These may produce `related`, never `matched`. */
export const CONTROLLED_RELATED_TERM_REGISTRY = {
  'ci-cd': ['github-actions', 'jenkins', 'gitlab-ci', 'circleci'],
  'cloud-platforms': ['aws', 'azure', 'gcp'],
  'customer-service': ['customer-interaction'],
  communication: ['customer-interaction', 'team-collaboration'],
  teamwork: ['team-collaboration'],
  'stock-replenishment': ['shelf-restocking'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

const CONTROLLED_CREDENTIAL_TERMS = new Set([
  'forklift-licence',
  'rsa',
  'driver-licence',
  'white-card',
  'first-aid',
  'cpr',
  'working-with-children',
  'ndis-worker-screening',
  'cpa',
]);

const AUSTRALIAN_JURISDICTIONS = {
  ACT: ['act', 'australian capital territory'],
  NSW: ['nsw', 'new south wales'],
  NT: ['nt', 'northern territory'],
  QLD: ['qld', 'queensland'],
  SA: ['sa', 'south australia'],
  TAS: ['tas', 'tasmania'],
  VIC: ['vic', 'victoria'],
  WA: ['wa', 'western australia'],
} as const;

export type EquivalentMatchBasis = 'exact' | 'controlled-alias';

function expandContractions(value: string): string {
  return value
    .replace(/[’]/g, "'")
    .replace(/\bdon't\b/gi, 'do not')
    .replace(/\bdoesn't\b/gi, 'does not')
    .replace(/\bdidn't\b/gi, 'did not')
    .replace(/\bhaven't\b/gi, 'have not')
    .replace(/\bhasn't\b/gi, 'has not')
    .replace(/\bisn't\b/gi, 'is not');
}

/** Safe comparison normalization; the original candidate text is retained. */
export function normalizeMatchText(value: string): string {
  return expandContractions(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-AU')
    .replace(/(^|[^a-z0-9])c\+\+(?=$|[^a-z0-9])/g, '$1 cpp ')
    .replace(/\bc#/g, ' csharp ')
    .replace(/\.net\b/g, ' dotnet ')
    .replace(/\blicense\b/g, ' licence ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Boundary-aware phrase check: `git` does not match `github`. */
export function containsNormalizedPhrase(
  haystack: string,
  needle: string,
): boolean {
  if (!haystack || !needle) {
    return false;
  }

  return ` ${haystack} `.includes(` ${needle} `);
}

const NORMALIZED_ALIASES = Object.entries(CONTROLLED_ALIAS_REGISTRY).map(
  ([canonical, aliases]) => ({
    canonical,
    aliases: Array.from(
      new Set([
        normalizeMatchText(canonical.replace(/-/g, ' ')),
        ...aliases.map(normalizeMatchText),
      ]),
    ).filter(Boolean),
  }),
);

export function buildNormalizedTerms(value: string): readonly string[] {
  const normalized = normalizeMatchText(value);

  if (!normalized) {
    return [];
  }

  const terms = new Set<string>([normalized]);

  for (const definition of NORMALIZED_ALIASES) {
    if (
      definition.aliases.some((alias) =>
        containsNormalizedPhrase(normalized, alias),
      )
    ) {
      terms.add(definition.canonical);
    }
  }

  return Array.from(terms);
}

function canonicalTerms(terms: readonly string[]): readonly string[] {
  return terms.filter((term) => term in CONTROLLED_ALIAS_REGISTRY);
}

export function findEquivalentMatch(
  requirement: string,
  evidenceTerms: readonly string[],
): EquivalentMatchBasis | undefined {
  const normalizedRequirement = normalizeMatchText(requirement);
  const normalizedEvidence = evidenceTerms[0] ?? '';

  if (
    normalizedRequirement &&
    containsNormalizedPhrase(normalizedEvidence, normalizedRequirement)
  ) {
    return 'exact';
  }

  const requirementAliases = canonicalTerms(buildNormalizedTerms(requirement));
  const evidenceAliases = new Set(canonicalTerms(evidenceTerms));

  if (requirementAliases.some((term) => evidenceAliases.has(term))) {
    return 'controlled-alias';
  }

  return undefined;
}

/**
 * Strict equality used for deduplicating user questions. Unlike matching, it
 * never treats phrase containment as identity (React !== React Native).
 */
export function areStrictControlledEquivalents(
  first: string,
  second: string,
): boolean {
  const normalizedFirst = normalizeMatchText(first);
  const normalizedSecond = normalizeMatchText(second);

  if (!normalizedFirst || !normalizedSecond) {
    return false;
  }

  if (normalizedFirst === normalizedSecond) {
    return true;
  }

  const exactCanonicalTerms = (normalizedValue: string) =>
    NORMALIZED_ALIASES.filter((definition) =>
      definition.aliases.includes(normalizedValue),
    ).map((definition) => definition.canonical);
  const secondTerms = new Set(exactCanonicalTerms(normalizedSecond));

  return exactCanonicalTerms(normalizedFirst).some((term) =>
    secondTerms.has(term),
  );
}

export function hasControlledRelatedMatch(
  requirement: string,
  evidenceTerms: readonly string[],
): boolean {
  const requirementTerms = canonicalTerms(buildNormalizedTerms(requirement));
  const evidenceAliases = new Set(canonicalTerms(evidenceTerms));

  return requirementTerms.some((requirementTerm) => {
    const relatedTerms = (
      CONTROLLED_RELATED_TERM_REGISTRY as Readonly<
        Record<string, readonly string[] | undefined>
      >
    )[requirementTerm];

    return relatedTerms?.some((term) => evidenceAliases.has(term)) ?? false;
  });
}

export function isControlledCredentialRequirement(value: string): boolean {
  return canonicalTerms(buildNormalizedTerms(value)).some((term) =>
    CONTROLLED_CREDENTIAL_TERMS.has(term),
  );
}

export function isFormalCredentialRequirementLabel(value: string): boolean {
  return (
    isControlledCredentialRequirement(value) ||
    /\b(?:licence|certification|certified|registration|accreditation|clearance|screening check|worker check)\b/.test(
      normalizeMatchText(value),
    )
  );
}

export function isFormalQualificationRequirementLabel(value: string): boolean {
  return /\b(?:bachelor|master(?: s| of)|doctorate|doctoral|phd|diploma|tertiary qualification|university degree|degree in|certificate (?:i|ii|iii|iv|v))\b/.test(
    normalizeMatchText(value),
  );
}

export function isAvailabilityRequirementLabel(value: string): boolean {
  return /\b(?:availability|available|weekends?|shifts?|roster)\b/.test(
    normalizeMatchText(value),
  );
}

/**
 * Prevents an obvious negative narrative mention from becoming positive proof.
 * Only structured negative answers create `confirmed-missing`; free text stays
 * unresolved because deterministic negation is intentionally conservative.
 */
export function isObviousNarrativeNegation(
  evidenceText: string,
  requirement: string,
): boolean {
  const normalizedEvidence = normalizeMatchText(evidenceText);
  const requirementTerms = buildNormalizedTerms(requirement);
  const searchPhrases = new Set<string>([normalizeMatchText(requirement)]);

  for (const term of canonicalTerms(requirementTerms)) {
    const definition = NORMALIZED_ALIASES.find(
      (candidate) => candidate.canonical === term,
    );
    definition?.aliases.forEach((alias) => searchPhrases.add(alias));
  }

  return hasNegatedSearchPhrase(normalizedEvidence, searchPhrases);
}

function hasNegatedSearchPhrase(
  normalizedEvidence: string,
  searchPhrases: ReadonlySet<string>,
): boolean {
  const evidenceTokens = normalizedEvidence.split(' ');

  for (const phrase of searchPhrases) {
    if (!phrase) {
      continue;
    }

    const phraseTokens = phrase.split(' ');

    for (let index = 0; index <= evidenceTokens.length - phraseTokens.length; index += 1) {
      const candidate = evidenceTokens.slice(index, index + phraseTokens.length);

      if (candidate.join(' ') !== phrase) {
        continue;
      }

      const prefix = evidenceTokens.slice(Math.max(0, index - 5), index).join(' ');

      if (
        /(?:^| )(?:no|not|never|without|lack|lacking|do not|does not|did not|have not|has not)(?: [a-z0-9]+){0,4}$/.test(
          prefix,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function isObviousRelatedNarrativeNegation(
  evidenceText: string,
  requirement: string,
): boolean {
  const normalizedEvidence = normalizeMatchText(evidenceText);
  const requirementTerms = canonicalTerms(buildNormalizedTerms(requirement));
  const relatedCanonicalTerms = requirementTerms.flatMap((requirementTerm) =>
    Array.from(
      (CONTROLLED_RELATED_TERM_REGISTRY as Readonly<
        Record<string, readonly string[] | undefined>
      >)[requirementTerm] ?? [],
    ),
  );
  const searchPhrases = new Set<string>();

  for (const term of relatedCanonicalTerms) {
    const definition = NORMALIZED_ALIASES.find(
      (candidate) => candidate.canonical === term,
    );
    definition?.aliases.forEach((alias) => searchPhrases.add(alias));
  }

  return hasNegatedSearchPhrase(normalizedEvidence, searchPhrases);
}

export function hasDurationQualifier(value: string): boolean {
  return /\b\d+\+?\s*(?:years?|yrs?|months?)\b/.test(
    normalizeMatchText(value),
  );
}

export function findAustralianJurisdiction(
  value: string | undefined,
): keyof typeof AUSTRALIAN_JURISDICTIONS | undefined {
  const normalized = normalizeMatchText(value ?? '');

  if (!normalized) {
    return undefined;
  }

  return (Object.entries(AUSTRALIAN_JURISDICTIONS) as ReadonlyArray<
    [keyof typeof AUSTRALIAN_JURISDICTIONS, readonly string[]]
  >).find(([, aliases]) =>
    aliases.some((alias) =>
      containsNormalizedPhrase(normalized, normalizeMatchText(alias)),
    ),
  )?.[0];
}

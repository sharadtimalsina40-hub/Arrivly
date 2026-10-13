import type {
  CandidateEvidence,
  JobMatchResult,
  MatchStatus,
  RequirementConfirmation,
  RequirementImportance,
  RequirementMatch,
} from '../types';

export interface JobMatchPanelProps {
  readonly result: JobMatchResult;
}

const STATUS_PRESENTATION: Readonly<
  Record<MatchStatus, { label: string; className: string }>
> = {
  matched: {
    label: 'Matched',
    className: 'border-accent/45 bg-accent/[0.09] text-accent',
  },
  related: {
    label: 'Related evidence',
    className: 'border-sky-200/35 bg-sky-200/[0.07] text-sky-100',
  },
  unresolved: {
    label: 'Needs confirmation',
    className: 'border-amber-200/35 bg-amber-200/[0.07] text-amber-100',
  },
  'confirmed-missing': {
    label: 'Confirmed missing',
    className: 'border-rose-200/35 bg-rose-200/[0.07] text-rose-100',
  },
};

const IMPORTANCE_PRESENTATION: Readonly<
  Record<
    RequirementImportance,
    { heading: string; description: string }
  >
> = {
  required: {
    heading: 'Required',
    description: 'Explicitly classified as required by the job analysis.',
  },
  preferred: {
    heading: 'Preferred',
    description: 'Explicitly classified as preferred by the job analysis.',
  },
  unspecified: {
    heading: 'Other advertised criteria',
    description:
      'The current analysis contract does not reliably label these as required or preferred.',
  },
};

function evidenceLabel(evidence: CandidateEvidence): string {
  return evidence.contextLabel
    ? `${evidence.sourceLabel} — ${evidence.contextLabel}`
    : evidence.sourceLabel;
}

interface RequirementRowProps {
  readonly match: RequirementMatch;
  readonly evidenceById: ReadonlyMap<string, CandidateEvidence>;
  readonly confirmationById: ReadonlyMap<string, RequirementConfirmation>;
}

function RequirementRow({
  match,
  evidenceById,
  confirmationById,
}: RequirementRowProps) {
  const status = STATUS_PRESENTATION[match.status];
  const evidence = match.evidenceRefs
    .map((reference) => evidenceById.get(reference))
    .filter((item): item is CandidateEvidence => item !== undefined);
  const confirmations = match.confirmationRefs
    .map((reference) => confirmationById.get(reference))
    .filter(
      (item): item is RequirementConfirmation => item !== undefined,
    );

  return (
    <li class="min-w-0 rounded-2xl border border-white/12 bg-black/15 p-4">
      <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p class="min-w-0 break-words text-sm font-bold text-white">
          {match.requirement.label}
        </p>
        <span
          class={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <p class="mt-2 break-words text-xs leading-relaxed text-white/65">
        {match.explanation}
      </p>

      {evidence.length > 0 && (
        <div class="mt-3">
          <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">
            Candidate source
          </p>
          <ul role="list" class="mt-2 space-y-2">
            {evidence.map((item) => (
              <li key={item.id} class="min-w-0 text-xs leading-relaxed text-white/75">
                <span class="font-bold text-white/85">
                  {evidenceLabel(item)}:
                </span>{' '}
                <span class="break-words">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmations.length > 0 && (
        <div class="mt-3">
          <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">
            Job-specific confirmation
          </p>
          <ul role="list" class="mt-2 space-y-2">
            {confirmations.map((confirmation) => (
              <li
                key={confirmation.id}
                class="text-xs leading-relaxed text-white/75"
              >
                <span class="font-bold text-white/85">
                  {confirmation.sourceLabel}:
                </span>{' '}
                {confirmation.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details class="mt-3 text-xs text-white/60">
        <summary class="w-fit cursor-pointer rounded text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Employer wording
        </summary>
        <p class="mt-2 break-words leading-relaxed">
          {match.requirement.employerEvidenceText}
        </p>
      </details>

    </li>
  );
}

interface RequirementGroupProps {
  readonly importance: RequirementImportance;
  readonly matches: readonly RequirementMatch[];
  readonly evidenceById: ReadonlyMap<string, CandidateEvidence>;
  readonly confirmationById: ReadonlyMap<string, RequirementConfirmation>;
}

function RequirementGroup({
  importance,
  matches,
  evidenceById,
  confirmationById,
}: RequirementGroupProps) {
  if (matches.length === 0) {
    return null;
  }

  const presentation = IMPORTANCE_PRESENTATION[importance];

  return (
    <section aria-labelledby={`job-match-${importance}-heading`}>
      <h4
        id={`job-match-${importance}-heading`}
        class="text-sm font-bold uppercase tracking-[0.12em] text-white"
      >
        {presentation.heading}
      </h4>
      <p class="mt-1 text-xs leading-relaxed text-white/55">
        {presentation.description}
      </p>
      <ul role="list" class="mt-3 space-y-3">
        {matches.map((match) => (
          <RequirementRow
            key={match.requirement.id}
            match={match}
            evidenceById={evidenceById}
            confirmationById={confirmationById}
          />
        ))}
      </ul>
    </section>
  );
}

/** Read-only review. It exposes provenance, but has no draft write controls. */
export default function JobMatchPanel({ result }: JobMatchPanelProps) {
  const evidenceById = new Map(
    result.evidenceIndex.items.map((item) => [item.id, item] as const),
  );
  const confirmationById = new Map(
    result.confirmationIndex.items.map(
      (confirmation) => [confirmation.id, confirmation] as const,
    ),
  );
  const order: readonly RequirementImportance[] = [
    'required',
    'preferred',
    'unspecified',
  ];
  const totalRequirements = result.matches.length;

  return (
    <section
      id="job-match-review-panel"
      aria-labelledby="job-match-review-heading"
      class="mb-5 rounded-3xl border border-accent/25 bg-accent/[0.045] p-5 sm:p-6"
    >
      <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Evidence review
      </p>
      <h3
        id="job-match-review-heading"
        class="mt-2 font-serif text-xl font-light text-white sm:text-2xl"
      >
        How your current details relate to this job
      </h3>
      <p class="mt-2 text-xs leading-relaxed text-white/65 sm:text-sm">
        Matches use only confirmed information in your draft or information you
        explicitly confirmed in a job-specific follow-up. “Needs confirmation”
        means no matching information is recorded; it does not mean you lack
        the requirement.
      </p>

      {totalRequirements === 0 ? (
        <p class="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-relaxed text-white/70">
          The analysis did not extract any requirements that can be compared.
        </p>
      ) : (
        <>
          <dl class="mt-5 grid gap-3 sm:grid-cols-3">
            {order.map((importance) => {
              const counts = result.summary[importance];

              return (
                <div
                  key={importance}
                  class="rounded-xl border border-white/10 bg-white/[0.035] p-3"
                >
                  <dt class="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
                    {IMPORTANCE_PRESENTATION[importance].heading}
                  </dt>
                  <dd class="mt-1 text-xs leading-relaxed text-white/75">
                    {counts.matched} matched · {counts.related} related ·{' '}
                    {counts.unresolved} to confirm · {counts.confirmedMissing}{' '}
                    confirmed missing
                  </dd>
                </div>
              );
            })}
          </dl>

          <div class="mt-6 space-y-7">
            {order.map((importance) => (
              <RequirementGroup
                key={importance}
                importance={importance}
                matches={result.matches.filter(
                  (match) => match.requirement.importance === importance,
                )}
                evidenceById={evidenceById}
                confirmationById={confirmationById}
              />
            ))}
          </div>
        </>
      )}

      <p class="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/55">
        This review does not edit your resume, add skills, or calculate a match
        percentage.
      </p>
    </section>
  );
}

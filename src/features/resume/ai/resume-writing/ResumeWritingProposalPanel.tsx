import type { Dispatch } from 'preact/hooks';
import {
  allResumeWritingSuggestionIds,
  experienceSuggestionId,
  skillSuggestionId,
  summarySuggestionId,
  type ResumeWritingReviewAction,
  type ResumeWritingReviewState,
} from './review';
import type {
  GeneratedResumeProposal,
  GeneratedText,
  ResumeWritingInput,
} from './types';
import type { CandidateEvidenceIndex } from '../../matching/types';

export type ResumeWritingGenerationStatus =
  | 'idle'
  | 'generating'
  | 'complete'
  | 'error';

export interface ResumeWritingProposalPanelProps {
  readonly status: ResumeWritingGenerationStatus;
  readonly input: ResumeWritingInput;
  readonly displayEvidence: CandidateEvidenceIndex;
  readonly proposal?: GeneratedResumeProposal;
  readonly rejectedStatements?: number;
  readonly errorMessage?: string;
  readonly reviewState: ResumeWritingReviewState;
  readonly dispatchReview: Dispatch<ResumeWritingReviewAction>;
  readonly onGenerate: () => void;
}

interface SuggestionCardProps {
  readonly id: string;
  readonly title: string;
  readonly suggestion: GeneratedText;
  readonly input: ResumeWritingInput;
  readonly displayEvidence: CandidateEvidenceIndex;
  readonly decision?: 'accepted' | 'kept-original';
  readonly dispatchReview: Dispatch<ResumeWritingReviewAction>;
}

function sourceLines(
  suggestion: GeneratedText,
  input: ResumeWritingInput,
  displayEvidence: CandidateEvidenceIndex,
): readonly string[] {
  const fallbackById = new Map(
    [...input.candidateEvidence, ...input.confirmedFollowUpEvidence].map(
      (item) => [item.id, item.text] as const,
    ),
  );
  const byId = new Map(
    displayEvidence.items.map((item) => [
      item.id,
      `${item.sourceLabel}${item.contextLabel ? ` — ${item.contextLabel}` : ''}: ${item.text}`,
    ] as const),
  );
  return Array.from(
    new Set(
      suggestion.sourceRefs
        .map(
          (sourceRef) => byId.get(sourceRef) ?? fallbackById.get(sourceRef),
        )
        .filter((text): text is string => Boolean(text)),
    ),
  );
}

function SuggestionCard({
  id,
  title,
  suggestion,
  input,
  displayEvidence,
  decision,
  dispatchReview,
}: SuggestionCardProps) {
  const originals = sourceLines(suggestion, input, displayEvidence);

  return (
    <li class="rounded-2xl border border-white/12 bg-black/10 p-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h5 class="text-sm font-bold text-white">{title}</h5>
        {decision && (
          <span class="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
            {decision === 'accepted' ? 'Accepted' : 'Original kept'}
          </span>
        )}
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            Original evidence
          </p>
          <ul class="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-white/70">
            {originals.map((original) => (
              <li key={original} class="break-words">{original}</li>
            ))}
          </ul>
        </div>
        <div class="min-w-0 rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
          <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
            Suggested
          </p>
          <p class="mt-2 break-words text-sm leading-relaxed text-white">
            {suggestion.text}
          </p>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        {decision === 'accepted' ? (
          <button
            type="button"
            onClick={() =>
              dispatchReview({ type: 'suggestion/undone', suggestionId: id })
            }
            class="min-h-11 rounded-full border border-accent/60 px-5 py-2.5 text-sm font-bold text-accent transition hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Undo acceptance
          </button>
        ) : (
          <button
            type="button"
            aria-pressed={false}
            onClick={() =>
              dispatchReview({ type: 'suggestion/accepted', suggestionId: id })
            }
            class="min-h-11 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Accept
          </button>
        )}
        <button
          type="button"
          aria-pressed={decision === 'kept-original'}
          onClick={() =>
            dispatchReview({
              type: 'suggestion/kept-original',
              suggestionId: id,
            })
          }
          class="min-h-11 rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Keep original
        </button>
      </div>
    </li>
  );
}

function hasSuggestions(proposal: GeneratedResumeProposal): boolean {
  return Boolean(
    proposal.summary ||
      proposal.experience.some((experience) => experience.bullets.length > 0) ||
      proposal.suggestedSkills.length > 0,
  );
}

export default function ResumeWritingProposalPanel({
  status,
  input,
  displayEvidence,
  proposal,
  rejectedStatements = 0,
  errorMessage,
  reviewState,
  dispatchReview,
  onGenerate,
}: ResumeWritingProposalPanelProps) {
  const evidenceCount =
    input.candidateEvidence.length + input.confirmedFollowUpEvidence.length;
  const suggestionIds = proposal
    ? allResumeWritingSuggestionIds(proposal)
    : [];

  return (
    <section
      aria-labelledby="resume-writing-heading"
      aria-busy={status === 'generating'}
      class="mb-5 rounded-3xl border border-accent/25 bg-accent/[0.045] p-5 sm:p-6"
    >
      <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Evidence-grounded writing
      </p>
      <h3 id="resume-writing-heading" class="mt-2 text-xl font-bold text-white">
        Tailored wording proposals
      </h3>
      <p id="resume-writing-help" class="mt-2 text-sm leading-relaxed text-white/65">
        One AI request may improve emphasis and wording, but only confirmed
        candidate evidence can support a claim. Job-ad wording is never treated
        as proof about you.
      </p>

      {evidenceCount === 0 ? (
        <p class="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-white/70">
          Add or confirm candidate details before requesting tailored wording.
        </p>
      ) : (
        <button
          type="button"
          disabled={status === 'generating'}
          aria-describedby="resume-writing-help"
          onClick={onGenerate}
          class="mt-5 min-h-11 rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'generating'
            ? 'Generating grounded suggestions…'
            : proposal
              ? 'Generate new suggestions'
              : 'Generate tailored suggestions'}
        </button>
      )}

      {status === 'generating' && (
        <p role="status" aria-live="polite" class="mt-3 text-sm text-white/70">
          Checking every suggested statement against your confirmed evidence…
        </p>
      )}

      {status === 'error' && errorMessage && (
        <p role="alert" class="mt-4 rounded-xl border border-red-300/50 bg-red-300/[0.08] p-3 text-sm text-red-100">
          {errorMessage}
        </p>
      )}

      {proposal && status === 'complete' && (
        <div class="mt-6">
          <div class="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 class="text-base font-bold text-white">Safe suggestions</h4>
              <p class="mt-1 text-xs leading-relaxed text-white/55">
                Accepted wording appears in the Tailored preview and exports.
                Your original resume facts remain unchanged.
              </p>
            </div>
            <div class="flex flex-col gap-2 sm:items-end">
              {suggestionIds.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    dispatchReview({
                      type: 'all-safe/accepted',
                      suggestionIds,
                    })
                  }
                  class="min-h-11 shrink-0 rounded-full border border-accent/60 px-4 py-2 text-xs font-bold text-accent transition hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Accept all safe suggestions
                </button>
              )}
              {Object.keys(reviewState.decisions).length > 0 && (
                <button
                  type="button"
                  onClick={() => dispatchReview({ type: 'all/reset' })}
                  class="min-h-10 shrink-0 rounded-full border border-white/25 px-4 py-2 text-xs font-bold text-white transition hover:border-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Reset all AI changes
                </button>
              )}
            </div>
          </div>

          {rejectedStatements > 0 && (
            <p role="status" class="mt-4 text-xs leading-relaxed text-amber-100">
              {rejectedStatements} unsupported {rejectedStatements === 1 ? 'statement was' : 'statements were'} withheld before review.
            </p>
          )}

          {!hasSuggestions(proposal) ? (
            <p class="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-white/70">
              No safe wording suggestions were produced. Your existing resume
              remains unchanged.
            </p>
          ) : (
            <div class="mt-5 space-y-6">
              {proposal.summary && (
                <section aria-labelledby="resume-writing-summary-heading">
                  <h4 id="resume-writing-summary-heading" class="text-sm font-bold uppercase tracking-[0.12em] text-white/60">
                    Professional summary
                  </h4>
                  <ul class="mt-3 list-none">
                    <SuggestionCard
                      id={summarySuggestionId}
                      title="Summary suggestion"
                      suggestion={proposal.summary}
                      input={input}
                      displayEvidence={displayEvidence}
                      decision={reviewState.decisions[summarySuggestionId]}
                      dispatchReview={dispatchReview}
                    />
                  </ul>
                </section>
              )}

              {proposal.experience.map((experience) => {
                const originalExperience = input.resume.experience.find(
                  (candidate) => candidate.id === experience.experienceId,
                );
                return (
                  <section key={experience.experienceId} aria-labelledby={`resume-writing-experience-${experience.experienceId}`}>
                    <h4
                      id={`resume-writing-experience-${experience.experienceId}`}
                      class="break-words text-sm font-bold uppercase tracking-[0.12em] text-white/60"
                    >
                      {originalExperience?.roleTitle ?? 'Experience'}
                    </h4>
                    <ul class="mt-3 list-none space-y-3">
                      {experience.bullets.map((bullet, index) => {
                        const id = experienceSuggestionId(
                          experience.experienceId,
                          index,
                        );
                        return (
                          <SuggestionCard
                            key={id}
                            id={id}
                            title={`Bullet ${index + 1}`}
                            suggestion={bullet}
                            input={input}
                            displayEvidence={displayEvidence}
                            decision={reviewState.decisions[id]}
                            dispatchReview={dispatchReview}
                          />
                        );
                      })}
                    </ul>
                  </section>
                );
              })}

              {proposal.suggestedSkills.length > 0 && (
                <section aria-labelledby="resume-writing-skills-heading">
                  <h4 id="resume-writing-skills-heading" class="text-sm font-bold uppercase tracking-[0.12em] text-white/60">
                    Relevant skill ordering
                  </h4>
                  <ul class="mt-3 list-none space-y-3">
                    {proposal.suggestedSkills.map((skill, index) => {
                      const id = skillSuggestionId(index);
                      return (
                        <SuggestionCard
                          key={id}
                          id={id}
                          title={`Skill ${index + 1}`}
                          suggestion={skill}
                          input={input}
                          displayEvidence={displayEvidence}
                          decision={reviewState.decisions[id]}
                          dispatchReview={dispatchReview}
                        />
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

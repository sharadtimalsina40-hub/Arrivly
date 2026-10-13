import type { TargetedEvent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { createEmptyExperienceHighlight } from '../model/defaults';
import type {
  ExperienceEntry,
  ExperienceKind,
  ResumeLocation,
  YearMonth,
} from '../model/types';
import {
  isOrganisationRequiredForExperience,
  type ResumeValidationErrors,
} from '../model/validation';
import type {
  ExperienceEntryChanges,
  ResumeDraftAction,
} from '../state/reducer';

export interface ExperienceEditorProps {
  readonly entry: ExperienceEntry;
  readonly position: number;
  readonly errors: ResumeValidationErrors;
  readonly dispatch: (action: ResumeDraftAction) => void;
}

export type ExperienceValidatedField =
  | 'role-title'
  | 'organisation'
  | 'start-date'
  | 'end-date';

const EXPERIENCE_KIND_OPTIONS = [
  { value: 'employment', label: 'Employment' },
  { value: 'self-employment', label: 'Self-employment' },
  { value: 'volunteer', label: 'Volunteer work' },
  { value: 'internship', label: 'Internship' },
  { value: 'placement', label: 'Placement' },
  { value: 'project', label: 'Project' },
  { value: 'education-project', label: 'Education project' },
] satisfies readonly {
  value: ExperienceKind;
  label: string;
}[];

const INPUT_CLASS =
  'w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-45';

function inputClass(hasError: boolean): string {
  return `${INPUT_CLASS} ${hasError ? 'border-red-300/80' : 'border-white/15'}`;
}

function now(): string {
  return new Date().toISOString();
}

function optionalValue(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function optionalYearMonth(value: string): YearMonth | undefined {
  return value === '' ? undefined : (value as YearMonth);
}

export function experienceFieldId(
  entryId: string,
  field: ExperienceValidatedField,
): string {
  return `experience-${entryId}-${field}`;
}

function highlightFieldId(entryId: string, highlightId: string): string {
  return `experience-${entryId}-highlight-${highlightId}`;
}

export default function ExperienceEditor({
  entry,
  position,
  errors,
  dispatch,
}: ExperienceEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const [isConfirmingCurrentRole, setIsConfirmingCurrentRole] =
    useState(false);
  const errorPath = `experience.${entry.id}`;
  const roleTitleError = errors[`${errorPath}.roleTitle`];
  const organisationError = errors[`${errorPath}.organisation`];
  const startDateError = errors[`${errorPath}.startDate`];
  const endDateError = errors[`${errorPath}.endDate`];
  const hasValidationError = Boolean(
    roleTitleError ||
      organisationError ||
      startDateError ||
      endDateError,
  );
  const showDetails = isExpanded || hasValidationError;
  const organisationRequired = isOrganisationRequiredForExperience(
    entry.kind,
  );
  const kindLabel =
    EXPERIENCE_KIND_OPTIONS.find((option) => option.value === entry.kind)
      ?.label ?? 'Experience';
  const displayTitle = entry.roleTitle.trim() || `Experience ${position + 1}`;
  const detailsRegionId = `experience-${entry.id}-details`;
  const editorHeadingId = `experience-${entry.id}-heading`;

  useEffect(() => {
    if (hasValidationError) {
      setIsExpanded(true);
    }
  }, [hasValidationError]);

  function updateEntry(changes: ExperienceEntryChanges) {
    dispatch({
      type: 'experience/entry-updated',
      entryId: entry.id,
      changes,
      at: now(),
    });
  }

  function addHighlight() {
    const highlight = createEmptyExperienceHighlight();

    dispatch({
      type: 'experience/highlight-added',
      entryId: entry.id,
      highlight,
      at: now(),
    });

    requestAnimationFrame(() => {
      document.getElementById(highlightFieldId(entry.id, highlight.id))?.focus();
    });
  }

  function updateHighlight(highlightId: string, text: string) {
    dispatch({
      type: 'experience/highlight-updated',
      entryId: entry.id,
      highlightId,
      text,
      at: now(),
    });
  }

  function removeHighlight(highlightId: string) {
    dispatch({
      type: 'experience/highlight-removed',
      entryId: entry.id,
      highlightId,
      at: now(),
    });

    requestAnimationFrame(() => {
      document.getElementById(`experience-${entry.id}-add-highlight`)?.focus();
    });
  }

  function requestRemoval() {
    setIsConfirmingRemoval(true);
    requestAnimationFrame(() => {
      document.getElementById(`experience-${entry.id}-keep`)?.focus();
    });
  }

  function cancelRemoval() {
    setIsConfirmingRemoval(false);
    requestAnimationFrame(() => {
      document.getElementById(`experience-${entry.id}-remove`)?.focus();
    });
  }

  function confirmRemoval() {
    dispatch({
      type: 'experience/entry-removed',
      entryId: entry.id,
      at: now(),
    });

    requestAnimationFrame(() => {
      document.getElementById('add-experience-entry')?.focus();
    });
  }

  function handleCurrentRoleChange(event: TargetedEvent<HTMLInputElement>) {
    const isCurrent = event.currentTarget.checked;

    if (isCurrent && entry.endDate) {
      setIsConfirmingCurrentRole(true);
      requestAnimationFrame(() => {
        document.getElementById(`experience-${entry.id}-keep-end-date`)?.focus();
      });
      return;
    }

    updateEntry({ isCurrent });
  }

  function keepEndDate() {
    setIsConfirmingCurrentRole(false);
    requestAnimationFrame(() => {
      document.getElementById(`experience-${entry.id}-is-current`)?.focus();
    });
  }

  function markAsCurrent() {
    setIsConfirmingCurrentRole(false);
    updateEntry({
      isCurrent: true,
      endDate: undefined,
    });
    requestAnimationFrame(() => {
      document.getElementById(`experience-${entry.id}-is-current`)?.focus();
    });
  }

  return (
    <section
      aria-labelledby={editorHeadingId}
      class="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.035]"
    >
      <div class="flex items-start gap-3 border-b border-white/10 p-4 sm:p-5">
        <h3 class="min-w-0 flex-1">
          <button
            id={editorHeadingId}
            type="button"
            aria-expanded={showDetails}
            aria-controls={detailsRegionId}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            class="block w-full rounded-lg text-left"
          >
            <span class="block truncate text-base font-bold text-white">
              {displayTitle}
            </span>
            <span class="mt-1 block text-xs text-white/55">
              {kindLabel} · {showDetails ? 'Hide details' : 'Edit details'}
            </span>
          </button>
        </h3>
        <button
          id={`experience-${entry.id}-remove`}
          type="button"
          onClick={requestRemoval}
          class="shrink-0 rounded-full border border-red-200/25 px-3 py-2 text-xs font-bold text-red-100 transition hover:border-red-200/50"
        >
          Remove
        </button>
      </div>

      {isConfirmingRemoval && (
        <div
          role="alert"
          class="border-b border-red-200/20 bg-red-200/[0.07] p-4 sm:p-5"
        >
          <p class="text-sm font-medium text-white">
            Remove “{displayTitle}” and all of its highlights?
          </p>
          <p class="mt-2 text-xs leading-relaxed text-white/65">
            This action removes the entry from the current resume draft.
          </p>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              id={`experience-${entry.id}-keep`}
              type="button"
              onClick={cancelRemoval}
              class="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink"
            >
              Keep experience
            </button>
            <button
              type="button"
              onClick={confirmRemoval}
              class="rounded-full border border-red-200/30 px-5 py-2.5 text-sm font-bold text-red-100"
            >
              Remove permanently
            </button>
          </div>
        </div>
      )}

      <div id={detailsRegionId} hidden={!showDetails} class="space-y-6 p-4 sm:p-5">
        <div>
          <label
            for={`experience-${entry.id}-kind`}
            class="mb-2 block text-sm font-medium text-white"
          >
            Experience type
          </label>
          <select
            id={`experience-${entry.id}-kind`}
            value={entry.kind}
            onChange={(event) =>
              updateEntry({
                kind: event.currentTarget.value as ExperienceKind,
              })
            }
            class={inputClass(false)}
          >
            {EXPERIENCE_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              for={experienceFieldId(entry.id, 'role-title')}
              class="mb-2 block text-sm font-medium text-white"
            >
              Role or title <span class="text-accent">(required)</span>
            </label>
            <input
              id={experienceFieldId(entry.id, 'role-title')}
              type="text"
              autocomplete="organization-title"
              value={entry.roleTitle}
              onInput={(event) =>
                updateEntry({ roleTitle: event.currentTarget.value })
              }
              placeholder="Cafe All-Rounder"
              required
              aria-invalid={Boolean(roleTitleError)}
              aria-describedby={
                roleTitleError
                  ? `experience-${entry.id}-role-title-error`
                  : undefined
              }
              class={inputClass(Boolean(roleTitleError))}
            />
            {roleTitleError && (
              <p
                id={`experience-${entry.id}-role-title-error`}
                class="mt-2 text-sm font-medium text-red-200"
              >
                {roleTitleError}
              </p>
            )}
          </div>

          <div>
            <label
              for={experienceFieldId(entry.id, 'organisation')}
              class="mb-2 block text-sm font-medium text-white"
            >
              Organisation{' '}
              <span class={organisationRequired ? 'text-accent' : 'text-white/55'}>
                ({organisationRequired ? 'required' : 'optional'})
              </span>
            </label>
            <input
              id={experienceFieldId(entry.id, 'organisation')}
              type="text"
              autocomplete="organization"
              value={entry.organisation ?? ''}
              onInput={(event) =>
                updateEntry({
                  organisation: optionalValue(event.currentTarget.value),
                })
              }
              placeholder="Harbour Cafe"
              required={organisationRequired}
              aria-invalid={Boolean(organisationError)}
              aria-describedby={
                organisationError
                  ? `experience-${entry.id}-organisation-error`
                  : undefined
              }
              class={inputClass(Boolean(organisationError))}
            />
            {organisationError && (
              <p
                id={`experience-${entry.id}-organisation-error`}
                class="mt-2 text-sm font-medium text-red-200"
              >
                {organisationError}
              </p>
            )}
          </div>
        </div>

        <div>
          <label
            for={`experience-${entry.id}-location`}
            class="mb-2 block text-sm font-medium text-white"
          >
            Location <span class="text-white/55">(optional)</span>
          </label>
          <input
            id={`experience-${entry.id}-location`}
            type="text"
            autocomplete="off"
            value={entry.location?.city ?? ''}
            onInput={(event) => {
              const city = event.currentTarget.value;
              const location: ResumeLocation | undefined =
                city === ''
                  ? undefined
                  : {
                      ...entry.location,
                      city,
                    };

              updateEntry({ location });
            }}
            placeholder="Sydney, NSW"
            class={inputClass(false)}
          />
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              for={experienceFieldId(entry.id, 'start-date')}
              class="mb-2 block text-sm font-medium text-white"
            >
              Start month <span class="text-white/55">(optional)</span>
            </label>
            <input
              id={experienceFieldId(entry.id, 'start-date')}
              type="month"
              value={entry.startDate ?? ''}
              onInput={(event) =>
                updateEntry({
                  startDate: optionalYearMonth(event.currentTarget.value),
                })
              }
              aria-invalid={Boolean(startDateError)}
              aria-describedby={
                startDateError
                  ? `experience-${entry.id}-start-date-error`
                  : undefined
              }
              class={inputClass(Boolean(startDateError))}
            />
            {startDateError && (
              <p
                id={`experience-${entry.id}-start-date-error`}
                class="mt-2 text-sm font-medium text-red-200"
              >
                {startDateError}
              </p>
            )}
          </div>

          <div>
            <label
              for={experienceFieldId(entry.id, 'end-date')}
              class="mb-2 block text-sm font-medium text-white"
            >
              End month <span class="text-white/55">(optional)</span>
            </label>
            <input
              id={experienceFieldId(entry.id, 'end-date')}
              type="month"
              value={entry.endDate ?? ''}
              onInput={(event) => {
                setIsConfirmingCurrentRole(false);
                updateEntry({
                  endDate: optionalYearMonth(event.currentTarget.value),
                });
              }}
              disabled={entry.isCurrent}
              aria-invalid={Boolean(endDateError)}
              aria-describedby={
                endDateError
                  ? `experience-${entry.id}-end-date-error`
                  : undefined
              }
              class={inputClass(Boolean(endDateError))}
            />
            {endDateError && (
              <p
                id={`experience-${entry.id}-end-date-error`}
                class="mt-2 text-sm font-medium text-red-200"
              >
                {endDateError}
              </p>
            )}
          </div>
        </div>

        <label class="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-white/75">
          <input
            id={`experience-${entry.id}-is-current`}
            type="checkbox"
            checked={entry.isCurrent}
            onChange={handleCurrentRoleChange}
            class="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span>I currently work here</span>
        </label>

        {isConfirmingCurrentRole && (
          <div
            role="alert"
            class="rounded-2xl border border-amber-200/35 bg-amber-200/[0.07] p-4"
          >
            <p class="text-sm font-medium text-white">
              Mark this experience as current?
            </p>
            <p class="mt-2 text-xs leading-relaxed text-white/65">
              Current experience cannot also have an end month. Confirming will
              remove {entry.endDate} from this entry.
            </p>
            <div class="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                id={`experience-${entry.id}-keep-end-date`}
                type="button"
                onClick={keepEndDate}
                class="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink"
              >
                Keep end month
              </button>
              <button
                type="button"
                onClick={markAsCurrent}
                class="rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white"
              >
                Mark as current
              </button>
            </div>
          </div>
        )}

        <div>
          <label
            for={`experience-${entry.id}-description`}
            class="mb-2 block text-sm font-medium text-white"
          >
            Description <span class="text-white/55">(optional)</span>
          </label>
          <textarea
            id={`experience-${entry.id}-description`}
            rows={4}
            value={entry.description ?? ''}
            onInput={(event) =>
              updateEntry({
                description: optionalValue(event.currentTarget.value),
              })
            }
            placeholder="Describe the role in your own words. We will not rewrite or embellish it yet."
            class={`${inputClass(false)} resize-y leading-relaxed`}
          />
        </div>

        <section aria-labelledby={`experience-${entry.id}-highlights-heading`}>
          <h4
            id={`experience-${entry.id}-highlights-heading`}
            class="text-sm font-medium text-white"
          >
            Highlights and responsibilities
          </h4>
          <p class="mt-2 text-xs leading-relaxed text-white/60">
            Add factual lines only. Do not invent metrics or achievements.
          </p>

          {entry.highlights.length > 0 && (
            <div class="mt-4 space-y-4">
              {entry.highlights.map((highlight, highlightIndex) => (
                <div key={highlight.id}>
                  <label
                    for={highlightFieldId(entry.id, highlight.id)}
                    class="mb-2 block text-xs font-medium text-white/75"
                  >
                    Highlight {highlightIndex + 1}
                  </label>
                  <div class="flex items-start gap-3">
                    <input
                      id={highlightFieldId(entry.id, highlight.id)}
                      type="text"
                      value={highlight.text}
                      onInput={(event) =>
                        updateHighlight(
                          highlight.id,
                          event.currentTarget.value,
                        )
                      }
                      placeholder="Helped customers find products"
                      class={inputClass(false)}
                    />
                    <button
                      type="button"
                      onClick={() => removeHighlight(highlight.id)}
                      aria-label={`Remove highlight ${highlightIndex + 1}`}
                      class="shrink-0 rounded-full border border-white/15 px-3 py-3 text-xs font-bold text-white/70 transition hover:border-white/35 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            id={`experience-${entry.id}-add-highlight`}
            type="button"
            onClick={addHighlight}
            class="mt-4 rounded-full border border-accent/40 px-5 py-2.5 text-sm font-bold text-accent transition hover:border-accent"
          >
            Add highlight
          </button>
        </section>
      </div>
    </section>
  );
}

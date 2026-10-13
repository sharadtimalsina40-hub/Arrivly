import type { TargetedEvent } from 'preact';
import { useState } from 'preact/hooks';
import type {
  EducationEntry,
  EducationStatus,
  ResumeLocation,
  YearMonth,
} from '../model/types';
import {
  isEducationCompletionRequired,
  type ResumeValidationErrors,
} from '../model/validation';
import type {
  EducationEntryChanges,
  ResumeDraftAction,
} from '../state/reducer';

export interface EducationEditorProps {
  readonly entry: EducationEntry;
  readonly position: number;
  readonly errors: ResumeValidationErrors;
  readonly dispatch: (action: ResumeDraftAction) => void;
}

export type EducationValidatedField =
  | 'qualification'
  | 'institution'
  | 'completion-date';

const EDUCATION_STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'current', label: 'Currently studying' },
  { value: 'incomplete', label: 'Incomplete' },
] satisfies readonly { value: EducationStatus; label: string }[];

const INPUT_CLASS =
  'w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-accent focus:outline-none';

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

export function educationFieldId(
  entryId: string,
  field: EducationValidatedField,
): string {
  return `education-${entryId}-${field}`;
}

export default function EducationEditor({
  entry,
  position,
  errors,
  dispatch,
}: EducationEditorProps) {
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const errorPath = `education.${entry.id}`;
  const qualificationError = errors[`${errorPath}.qualification`];
  const institutionError = errors[`${errorPath}.institution`];
  const completionDateError = errors[`${errorPath}.completionDate`];
  const completionRequired = isEducationCompletionRequired(entry.status);
  const displayTitle = entry.qualification.trim() || `Education ${position + 1}`;

  function updateEntry(changes: EducationEntryChanges) {
    dispatch({
      type: 'education/entry-updated',
      entryId: entry.id,
      changes,
      at: now(),
    });
  }

  function requestRemoval() {
    setIsConfirmingRemoval(true);
    requestAnimationFrame(() => {
      document.getElementById(`education-${entry.id}-keep`)?.focus();
    });
  }

  function cancelRemoval() {
    setIsConfirmingRemoval(false);
    requestAnimationFrame(() => {
      document.getElementById(`education-${entry.id}-remove`)?.focus();
    });
  }

  function confirmRemoval() {
    dispatch({
      type: 'education/entry-removed',
      entryId: entry.id,
      at: now(),
    });

    requestAnimationFrame(() => {
      document.getElementById('add-education-entry')?.focus();
    });
  }

  function handleLocationInput(event: TargetedEvent<HTMLInputElement>) {
    const city = event.currentTarget.value;
    const location: ResumeLocation | undefined = city
      ? { ...entry.location, city }
      : undefined;

    updateEntry({ location });
  }

  return (
    <section
      aria-labelledby={`education-${entry.id}-heading`}
      class="rounded-2xl border border-white/12 bg-white/[0.035] p-4 sm:p-5"
    >
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <h4
            id={`education-${entry.id}-heading`}
            class="truncate text-base font-bold text-white"
          >
            {displayTitle}
          </h4>
          <p class="mt-1 text-xs text-white/55">
            {EDUCATION_STATUS_OPTIONS.find(
              (option) => option.value === entry.status,
            )?.label ?? 'Education'}
          </p>
        </div>
        <button
          id={`education-${entry.id}-remove`}
          type="button"
          onClick={requestRemoval}
          class="shrink-0 rounded-full border border-red-200/25 px-3 py-2 text-xs font-bold text-red-100 transition hover:border-red-200/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Remove
        </button>
      </div>

      {isConfirmingRemoval && (
        <div
          role="alert"
          class="mt-4 rounded-2xl border border-red-200/20 bg-red-200/[0.07] p-4"
        >
          <p class="text-sm font-medium text-white">
            Remove “{displayTitle}” from this draft?
          </p>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              id={`education-${entry.id}-keep`}
              type="button"
              onClick={cancelRemoval}
              class="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink"
            >
              Keep education
            </button>
            <button
              type="button"
              onClick={confirmRemoval}
              class="rounded-full border border-red-200/30 px-5 py-2.5 text-sm font-bold text-red-100"
            >
              Remove entry
            </button>
          </div>
        </div>
      )}

      <div class="mt-5 space-y-5">
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              for={educationFieldId(entry.id, 'qualification')}
              class="mb-2 block text-sm font-medium text-white"
            >
              Qualification <span class="text-accent">(required)</span>
            </label>
            <input
              id={educationFieldId(entry.id, 'qualification')}
              type="text"
              value={entry.qualification}
              onInput={(event) =>
                updateEntry({ qualification: event.currentTarget.value })
              }
              placeholder="Bachelor of Information Technology"
              required
              aria-invalid={Boolean(qualificationError)}
              aria-describedby={
                qualificationError
                  ? `education-${entry.id}-qualification-error`
                  : undefined
              }
              class={inputClass(Boolean(qualificationError))}
            />
            {qualificationError && (
              <p
                id={`education-${entry.id}-qualification-error`}
                class="mt-2 text-sm font-medium text-red-200"
              >
                {qualificationError}
              </p>
            )}
          </div>

          <div>
            <label
              for={`education-${entry.id}-field-of-study`}
              class="mb-2 block text-sm font-medium text-white"
            >
              Field of study <span class="text-white/55">(optional)</span>
            </label>
            <input
              id={`education-${entry.id}-field-of-study`}
              type="text"
              value={entry.fieldOfStudy ?? ''}
              onInput={(event) =>
                updateEntry({
                  fieldOfStudy: optionalValue(event.currentTarget.value),
                })
              }
              placeholder="Computer Applications"
              class={inputClass(false)}
            />
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              for={educationFieldId(entry.id, 'institution')}
              class="mb-2 block text-sm font-medium text-white"
            >
              Institution <span class="text-accent">(required)</span>
            </label>
            <input
              id={educationFieldId(entry.id, 'institution')}
              type="text"
              autocomplete="organization"
              value={entry.institution}
              onInput={(event) =>
                updateEntry({ institution: event.currentTarget.value })
              }
              placeholder="RMIT University"
              required
              aria-invalid={Boolean(institutionError)}
              aria-describedby={
                institutionError
                  ? `education-${entry.id}-institution-error`
                  : undefined
              }
              class={inputClass(Boolean(institutionError))}
            />
            {institutionError && (
              <p
                id={`education-${entry.id}-institution-error`}
                class="mt-2 text-sm font-medium text-red-200"
              >
                {institutionError}
              </p>
            )}
          </div>

          <div>
            <label
              for={`education-${entry.id}-location`}
              class="mb-2 block text-sm font-medium text-white"
            >
              Location <span class="text-white/55">(optional)</span>
            </label>
            <input
              id={`education-${entry.id}-location`}
              type="text"
              value={entry.location?.city ?? ''}
              onInput={handleLocationInput}
              placeholder="Melbourne, VIC"
              class={inputClass(false)}
            />
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              for={`education-${entry.id}-status`}
              class="mb-2 block text-sm font-medium text-white"
            >
              Study status
            </label>
            <select
              id={`education-${entry.id}-status`}
              value={entry.status}
              onChange={(event) =>
                updateEntry({
                  status: event.currentTarget.value as EducationStatus,
                })
              }
              class={inputClass(false)}
            >
              {EDUCATION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              for={educationFieldId(entry.id, 'completion-date')}
              class="mb-2 block text-sm font-medium text-white"
            >
              {entry.status === 'current'
                ? 'Expected completion month'
                : entry.status === 'incomplete'
                  ? 'Last study month'
                  : 'Completion month'}{' '}
              <span class={completionRequired ? 'text-accent' : 'text-white/55'}>
                ({completionRequired ? 'required' : 'optional'})
              </span>
            </label>
            <input
              id={educationFieldId(entry.id, 'completion-date')}
              type="month"
              value={entry.completionDate ?? ''}
              onInput={(event) =>
                updateEntry({
                  completionDate: optionalYearMonth(event.currentTarget.value),
                })
              }
              required={completionRequired}
              aria-invalid={Boolean(completionDateError)}
              aria-describedby={
                completionDateError
                  ? `education-${entry.id}-completion-date-error`
                  : undefined
              }
              class={inputClass(Boolean(completionDateError))}
            />
            {completionDateError && (
              <p
                id={`education-${entry.id}-completion-date-error`}
                class="mt-2 text-sm font-medium text-red-200"
              >
                {completionDateError}
              </p>
            )}
          </div>
        </div>

        <p class="text-xs leading-relaxed text-white/55">
          Enter the qualification exactly as awarded. We do not infer grades or
          Australian equivalence.
        </p>
      </div>
    </section>
  );
}

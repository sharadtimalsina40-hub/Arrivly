import { useState } from 'preact/hooks';
import type { LicenceEntry, LicenceStatus, YearMonth } from '../model/types';
import type { ResumeValidationErrors } from '../model/validation';
import type {
  LicenceEntryChanges,
  ResumeDraftAction,
} from '../state/reducer';

export interface LicenceEditorProps {
  readonly entry: LicenceEntry;
  readonly position: number;
  readonly errors: ResumeValidationErrors;
  readonly dispatch: (action: ResumeDraftAction) => void;
}

export type LicenceValidatedField = 'name' | 'expiry-date';

const LICENCE_STATUS_OPTIONS = [
  { value: 'current', label: 'Current' },
  { value: 'expired', label: 'Expired' },
  { value: 'in-progress', label: 'In progress' },
] satisfies readonly { value: LicenceStatus; label: string }[];

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

export function licenceFieldId(
  entryId: string,
  field: LicenceValidatedField,
): string {
  return `licence-${entryId}-${field}`;
}

export default function LicenceEditor({
  entry,
  position,
  errors,
  dispatch,
}: LicenceEditorProps) {
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const errorPath = `licences.${entry.id}`;
  const nameError = errors[`${errorPath}.name`];
  const expiryDateError = errors[`${errorPath}.expiryDate`];
  const displayName = entry.name.trim() || `Licence ${position + 1}`;

  function updateEntry(changes: LicenceEntryChanges) {
    dispatch({
      type: 'licences/entry-updated',
      entryId: entry.id,
      changes,
      at: now(),
    });
  }

  function requestRemoval() {
    setIsConfirmingRemoval(true);
    requestAnimationFrame(() => {
      document.getElementById(`licence-${entry.id}-keep`)?.focus();
    });
  }

  function cancelRemoval() {
    setIsConfirmingRemoval(false);
    requestAnimationFrame(() => {
      document.getElementById(`licence-${entry.id}-remove`)?.focus();
    });
  }

  function confirmRemoval() {
    dispatch({
      type: 'licences/entry-removed',
      entryId: entry.id,
      at: now(),
    });

    requestAnimationFrame(() => {
      document.getElementById('add-licence-entry')?.focus();
    });
  }

  return (
    <section
      aria-labelledby={`licence-${entry.id}-heading`}
      class="rounded-2xl border border-white/12 bg-white/[0.035] p-4 sm:p-5"
    >
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <h4
            id={`licence-${entry.id}-heading`}
            class="truncate text-base font-bold text-white"
          >
            {displayName}
          </h4>
          <p class="mt-1 text-xs text-white/55">Licence or certification</p>
        </div>
        <button
          id={`licence-${entry.id}-remove`}
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
            Remove “{displayName}” from this draft?
          </p>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              id={`licence-${entry.id}-keep`}
              type="button"
              onClick={cancelRemoval}
              class="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink"
            >
              Keep licence
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
        <div>
          <label
            for={licenceFieldId(entry.id, 'name')}
            class="mb-2 block text-sm font-medium text-white"
          >
            Name <span class="text-accent">(required)</span>
          </label>
          <input
            id={licenceFieldId(entry.id, 'name')}
            type="text"
            value={entry.name}
            onInput={(event) =>
              updateEntry({ name: event.currentTarget.value })
            }
            placeholder="RSA"
            required
            aria-invalid={Boolean(nameError)}
            aria-describedby={
              nameError ? `licence-${entry.id}-name-error` : undefined
            }
            class={inputClass(Boolean(nameError))}
          />
          {nameError && (
            <p
              id={`licence-${entry.id}-name-error`}
              class="mt-2 text-sm font-medium text-red-200"
            >
              {nameError}
            </p>
          )}
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              for={`licence-${entry.id}-issuer`}
              class="mb-2 block text-sm font-medium text-white"
            >
              Issuer <span class="text-white/55">(optional)</span>
            </label>
            <input
              id={`licence-${entry.id}-issuer`}
              type="text"
              value={entry.issuer ?? ''}
              onInput={(event) =>
                updateEntry({ issuer: optionalValue(event.currentTarget.value) })
              }
              placeholder="Liquor & Gaming NSW"
              class={inputClass(false)}
            />
          </div>

          <div>
            <label
              for={`licence-${entry.id}-jurisdiction`}
              class="mb-2 block text-sm font-medium text-white"
            >
              Jurisdiction <span class="text-white/55">(optional)</span>
            </label>
            <input
              id={`licence-${entry.id}-jurisdiction`}
              type="text"
              value={entry.jurisdiction ?? ''}
              onInput={(event) =>
                updateEntry({
                  jurisdiction: optionalValue(event.currentTarget.value),
                })
              }
              placeholder="NSW"
              class={inputClass(false)}
            />
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              for={`licence-${entry.id}-status`}
              class="mb-2 block text-sm font-medium text-white"
            >
              Status
            </label>
            <select
              id={`licence-${entry.id}-status`}
              value={entry.status}
              onChange={(event) =>
                updateEntry({
                  status: event.currentTarget.value as LicenceStatus,
                })
              }
              class={inputClass(false)}
            >
              {LICENCE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              for={licenceFieldId(entry.id, 'expiry-date')}
              class="mb-2 block text-sm font-medium text-white"
            >
              Expiry month <span class="text-white/55">(optional)</span>
            </label>
            <input
              id={licenceFieldId(entry.id, 'expiry-date')}
              type="month"
              value={entry.expiryDate ?? ''}
              onInput={(event) =>
                updateEntry({
                  expiryDate: optionalYearMonth(event.currentTarget.value),
                })
              }
              aria-invalid={Boolean(expiryDateError)}
              aria-describedby={
                expiryDateError
                  ? `licence-${entry.id}-expiry-date-error`
                  : undefined
              }
              class={inputClass(Boolean(expiryDateError))}
            />
            {expiryDateError && (
              <p
                id={`licence-${entry.id}-expiry-date-error`}
                class="mt-2 text-sm font-medium text-red-200"
              >
                {expiryDateError}
              </p>
            )}
          </div>
        </div>

        <p class="text-xs leading-relaxed text-white/55">
          Only add licences and certifications you actually hold or are
          explicitly completing.
        </p>
      </div>
    </section>
  );
}

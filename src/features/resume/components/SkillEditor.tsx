import { useState } from 'preact/hooks';
import type { SkillCategory, SkillEntry } from '../model/types';
import type { ResumeValidationErrors } from '../model/validation';
import type {
  ResumeDraftAction,
  SkillEntryChanges,
} from '../state/reducer';

export interface SkillEditorProps {
  readonly entry: SkillEntry;
  readonly position: number;
  readonly errors: ResumeValidationErrors;
  readonly dispatch: (action: ResumeDraftAction) => void;
}

const SKILL_CATEGORY_OPTIONS = [
  { value: 'industry', label: 'Industry' },
  { value: 'technical', label: 'Technical' },
  { value: 'software', label: 'Software' },
  { value: 'language', label: 'Language' },
  { value: 'transferable', label: 'Transferable' },
  { value: 'other', label: 'Other' },
] satisfies readonly { value: SkillCategory; label: string }[];

const INPUT_CLASS =
  'w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-accent focus:outline-none';

function inputClass(hasError: boolean): string {
  return `${INPUT_CLASS} ${hasError ? 'border-red-300/80' : 'border-white/15'}`;
}

function now(): string {
  return new Date().toISOString();
}

export function skillNameFieldId(entryId: string): string {
  return `skill-${entryId}-name`;
}

export default function SkillEditor({
  entry,
  position,
  errors,
  dispatch,
}: SkillEditorProps) {
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const nameError = errors[`skills.${entry.id}.name`];
  const displayName = entry.name.trim() || `Skill ${position + 1}`;

  function updateEntry(changes: SkillEntryChanges) {
    dispatch({
      type: 'skills/entry-updated',
      entryId: entry.id,
      changes,
      at: now(),
    });
  }

  function requestRemoval() {
    setIsConfirmingRemoval(true);
    requestAnimationFrame(() => {
      document.getElementById(`skill-${entry.id}-keep`)?.focus();
    });
  }

  function cancelRemoval() {
    setIsConfirmingRemoval(false);
    requestAnimationFrame(() => {
      document.getElementById(`skill-${entry.id}-remove`)?.focus();
    });
  }

  function confirmRemoval() {
    dispatch({
      type: 'skills/entry-removed',
      entryId: entry.id,
      at: now(),
    });

    requestAnimationFrame(() => {
      document.getElementById('add-skill-entry')?.focus();
    });
  }

  return (
    <section
      aria-label={`Skill ${position + 1}: ${displayName}`}
      class="rounded-2xl border border-white/12 bg-white/[0.035] p-4"
    >
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.55fr)_auto] sm:items-start">
        <div>
          <label
            for={skillNameFieldId(entry.id)}
            class="mb-2 block text-sm font-medium text-white"
          >
            Skill name <span class="text-accent">(required)</span>
          </label>
          <input
            id={skillNameFieldId(entry.id)}
            type="text"
            value={entry.name}
            onInput={(event) =>
              updateEntry({ name: event.currentTarget.value })
            }
            placeholder="Customer Service"
            required
            aria-invalid={Boolean(nameError)}
            aria-describedby={
              nameError ? `skill-${entry.id}-name-error` : undefined
            }
            class={inputClass(Boolean(nameError))}
          />
          {nameError && (
            <p
              id={`skill-${entry.id}-name-error`}
              class="mt-2 text-sm font-medium text-red-200"
            >
              {nameError}
            </p>
          )}
        </div>

        <div>
          <label
            for={`skill-${entry.id}-category`}
            class="mb-2 block text-sm font-medium text-white"
          >
            Category
          </label>
          <select
            id={`skill-${entry.id}-category`}
            value={entry.category}
            onChange={(event) =>
              updateEntry({
                category: event.currentTarget.value as SkillCategory,
              })
            }
            class={inputClass(false)}
          >
            {SKILL_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          id={`skill-${entry.id}-remove`}
          type="button"
          onClick={requestRemoval}
          class="rounded-full border border-red-200/25 px-4 py-3 text-xs font-bold text-red-100 transition hover:border-red-200/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:mt-7"
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
              id={`skill-${entry.id}-keep`}
              type="button"
              onClick={cancelRemoval}
              class="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink"
            >
              Keep skill
            </button>
            <button
              type="button"
              onClick={confirmRemoval}
              class="rounded-full border border-red-200/30 px-5 py-2.5 text-sm font-bold text-red-100"
            >
              Remove skill
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

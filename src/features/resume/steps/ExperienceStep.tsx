import type { TargetedEvent } from 'preact';
import { useState } from 'preact/hooks';
import ExperienceEditor, {
  experienceFieldId,
  type ExperienceValidatedField,
} from '../components/ExperienceEditor';
import { createEmptyExperienceEntry } from '../model/defaults';
import type { ResumeDraftV1 } from '../model/types';
import {
  validateResumeDraft,
  type ResumeValidationErrors,
} from '../model/validation';
import type { ResumeDraftAction } from '../state/reducer';

export interface ExperienceStepProps {
  readonly draft: ResumeDraftV1;
  readonly dispatch: (action: ResumeDraftAction) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly backLabel?: string;
  readonly continueLabel?: string;
}

const EMPTY_ERRORS: ResumeValidationErrors = {};

const EXPERIENCE_VALIDATION_FIELDS = [
  {
    pathSuffix: 'roleTitle',
    field: 'role-title',
  },
  {
    pathSuffix: 'organisation',
    field: 'organisation',
  },
  {
    pathSuffix: 'startDate',
    field: 'start-date',
  },
  {
    pathSuffix: 'endDate',
    field: 'end-date',
  },
] as const satisfies readonly {
  pathSuffix: string;
  field: ExperienceValidatedField;
}[];

function now(): string {
  return new Date().toISOString();
}

export default function ExperienceStep({
  draft,
  dispatch,
  onBack,
  onContinue,
  backLabel = 'Back',
  continueLabel = 'Continue',
}: ExperienceStepProps) {
  const [hasAttemptedContinue, setHasAttemptedContinue] = useState(false);
  const validation = hasAttemptedContinue
    ? validateResumeDraft(draft)
    : undefined;
  const errors = validation?.errors ?? EMPTY_ERRORS;
  const hasEntries = draft.experience.length > 0;
  const noFormalExperienceError =
    errors['experienceInput.hasNoFormalExperience'];

  function addExperience() {
    const entry = createEmptyExperienceEntry();
    setHasAttemptedContinue(false);

    dispatch({
      type: 'experience/entry-added',
      entry,
      at: now(),
    });

    requestAnimationFrame(() => {
      document
        .getElementById(experienceFieldId(entry.id, 'role-title'))
        ?.focus();
    });
  }

  function handleNoFormalExperienceChange(
    event: TargetedEvent<HTMLInputElement>,
  ) {
    dispatch({
      type: 'experience/no-formal-experience-changed',
      hasNoFormalExperience: event.currentTarget.checked,
      at: now(),
    });
  }

  function handleSubmit(
    event: TargetedEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    setHasAttemptedContinue(true);

    const result = validateResumeDraft(draft);
    let firstInvalidFieldId = result.errors[
      'experienceInput.hasNoFormalExperience'
    ]
      ? 'no-formal-experience'
      : undefined;

    for (const entry of firstInvalidFieldId ? [] : draft.experience) {
      for (const validationField of EXPERIENCE_VALIDATION_FIELDS) {
        const path = `experience.${entry.id}.${validationField.pathSuffix}`;

        if (result.errors[path]) {
          firstInvalidFieldId = experienceFieldId(
            entry.id,
            validationField.field,
          );
          break;
        }
      }

      if (firstInvalidFieldId) {
        break;
      }
    }

    if (firstInvalidFieldId) {
      requestAnimationFrame(() => {
        document.getElementById(firstInvalidFieldId)?.focus();
      });
      return;
    }

    onContinue();
  }

  return (
    <form
      class="glass rounded-3xl p-6 sm:p-8"
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby="experience-step-heading"
    >
      <p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
        Step 3 of 6
      </p>
      <h2
        id="experience-step-heading"
        tabIndex={-1}
        class="mb-3 font-serif text-2xl font-light tracking-tight text-white sm:text-3xl"
      >
        Experience
      </h2>
      <p class="mb-8 max-w-xl text-sm leading-relaxed text-white/70">
        Add paid work, volunteering, internships, placements, self-employment,
        or projects. Use your own factual wording—we will not embellish it.
      </p>

      <div class="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <label
          class={`flex items-start gap-3 text-sm leading-relaxed ${
            hasEntries
              ? 'cursor-not-allowed text-white/45'
              : 'cursor-pointer text-white/80'
          }`}
        >
          <input
            id="no-formal-experience"
            type="checkbox"
            checked={draft.experienceInput.hasNoFormalExperience}
            disabled={hasEntries}
            onChange={handleNoFormalExperienceChange}
            aria-invalid={Boolean(noFormalExperienceError)}
            aria-describedby={
              noFormalExperienceError
                ? 'no-formal-experience-help no-formal-experience-error'
                : 'no-formal-experience-help'
            }
            class="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span>I don&apos;t have formal work experience yet.</span>
        </label>
        <p
          id="no-formal-experience-help"
          class="mt-2 pl-7 text-xs leading-relaxed text-white/60"
        >
          {hasEntries
            ? 'Remove the existing entries before selecting this option.'
            : 'That is okay. You can continue and later add education, volunteering, projects, and transferable skills.'}
        </p>
        {noFormalExperienceError && (
          <p
            id="no-formal-experience-error"
            class="mt-2 pl-7 text-sm font-medium text-red-200"
          >
            {noFormalExperienceError}
          </p>
        )}
      </div>

      {hasEntries && (
        <div class="mt-6 space-y-4">
          {draft.experience.map((entry, index) => (
            <ExperienceEditor
              key={entry.id}
              entry={entry}
              position={index}
              errors={errors}
              dispatch={dispatch}
            />
          ))}
        </div>
      )}

      <button
        id="add-experience-entry"
        type="button"
        onClick={addExperience}
        class="mt-6 w-full rounded-2xl border border-dashed border-accent/45 bg-accent/[0.04] px-5 py-4 text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/[0.08]"
      >
        {draft.experienceInput.hasNoFormalExperience
          ? 'Add experience instead'
          : 'Add experience'}
      </button>

      <div class="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          class="rounded-full border border-white/20 px-7 py-3 text-sm font-bold text-white transition hover:border-white/40"
        >
          {backLabel}
        </button>
        <button
          type="submit"
          class="rounded-full bg-accent px-7 py-3 text-sm font-bold text-ink transition hover:brightness-105"
        >
          {continueLabel}
        </button>
      </div>
    </form>
  );
}

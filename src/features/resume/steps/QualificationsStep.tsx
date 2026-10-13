import type { TargetedEvent } from 'preact';
import { useState } from 'preact/hooks';
import EducationEditor, {
  educationFieldId,
  type EducationValidatedField,
} from '../components/EducationEditor';
import LicenceEditor, {
  licenceFieldId,
  type LicenceValidatedField,
} from '../components/LicenceEditor';
import SkillEditor, {
  skillNameFieldId,
} from '../components/SkillEditor';
import {
  createEmptyEducationEntry,
  createEmptyLicenceEntry,
  createEmptySkillEntry,
} from '../model/defaults';
import type { ResumeDraftV1 } from '../model/types';
import {
  validateResumeDraft,
  type ResumeValidationErrors,
} from '../model/validation';
import type { ResumeDraftAction } from '../state/reducer';

export interface QualificationsStepProps {
  readonly draft: ResumeDraftV1;
  readonly dispatch: (action: ResumeDraftAction) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly backLabel?: string;
  readonly continueLabel?: string;
}

const EMPTY_ERRORS: ResumeValidationErrors = {};

const EDUCATION_VALIDATION_FIELDS = [
  { pathSuffix: 'qualification', field: 'qualification' },
  { pathSuffix: 'institution', field: 'institution' },
  { pathSuffix: 'completionDate', field: 'completion-date' },
] as const satisfies readonly {
  pathSuffix: string;
  field: EducationValidatedField;
}[];

const LICENCE_VALIDATION_FIELDS = [
  { pathSuffix: 'name', field: 'name' },
  { pathSuffix: 'expiryDate', field: 'expiry-date' },
] as const satisfies readonly {
  pathSuffix: string;
  field: LicenceValidatedField;
}[];

function now(): string {
  return new Date().toISOString();
}

function findFirstInvalidFieldId(
  draft: ResumeDraftV1,
  errors: ResumeValidationErrors,
): string | undefined {
  for (const entry of draft.education) {
    for (const validationField of EDUCATION_VALIDATION_FIELDS) {
      const path = `education.${entry.id}.${validationField.pathSuffix}`;

      if (errors[path]) {
        return educationFieldId(entry.id, validationField.field);
      }
    }
  }

  for (const entry of draft.skills) {
    if (errors[`skills.${entry.id}.name`]) {
      return skillNameFieldId(entry.id);
    }
  }

  for (const entry of draft.licences) {
    for (const validationField of LICENCE_VALIDATION_FIELDS) {
      const path = `licences.${entry.id}.${validationField.pathSuffix}`;

      if (errors[path]) {
        return licenceFieldId(entry.id, validationField.field);
      }
    }
  }

  return undefined;
}

export default function QualificationsStep({
  draft,
  dispatch,
  onBack,
  onContinue,
  backLabel = 'Back',
  continueLabel = 'Continue',
}: QualificationsStepProps) {
  const [hasAttemptedContinue, setHasAttemptedContinue] = useState(false);
  const validation = hasAttemptedContinue
    ? validateResumeDraft(draft)
    : undefined;
  const errors = validation?.errors ?? EMPTY_ERRORS;

  function addEducation() {
    const entry = createEmptyEducationEntry();
    setHasAttemptedContinue(false);
    dispatch({ type: 'education/entry-added', entry, at: now() });

    requestAnimationFrame(() => {
      document
        .getElementById(educationFieldId(entry.id, 'qualification'))
        ?.focus();
    });
  }

  function addSkill() {
    const entry = createEmptySkillEntry();
    setHasAttemptedContinue(false);
    dispatch({ type: 'skills/entry-added', entry, at: now() });

    requestAnimationFrame(() => {
      document.getElementById(skillNameFieldId(entry.id))?.focus();
    });
  }

  function addLicence() {
    const entry = createEmptyLicenceEntry();
    setHasAttemptedContinue(false);
    dispatch({ type: 'licences/entry-added', entry, at: now() });

    requestAnimationFrame(() => {
      document.getElementById(licenceFieldId(entry.id, 'name'))?.focus();
    });
  }

  function handleSubmit(
    event: TargetedEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    setHasAttemptedContinue(true);

    const result = validateResumeDraft(draft);
    const firstInvalidFieldId = findFirstInvalidFieldId(draft, result.errors);

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
      aria-labelledby="qualifications-step-heading"
    >
      <p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
        Step 4 of 6
      </p>
      <h2
        id="qualifications-step-heading"
        tabIndex={-1}
        class="mb-3 font-serif text-2xl font-light tracking-tight text-white sm:text-3xl"
      >
        Education, skills and licences
      </h2>
      <p class="mb-8 max-w-xl text-sm leading-relaxed text-white/70">
        Add only facts that are true for you. Job-ad keywords are never copied
        into your skills or credentials without your confirmation.
      </p>

      <section aria-labelledby="education-section-heading">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Section 1
          </p>
          <h3
            id="education-section-heading"
            class="mt-2 text-xl font-bold text-white"
          >
            Education
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-white/60">
            Qualifications can be Australian or overseas. Grades and GPA are
            not required.
          </p>
        </div>

        {draft.education.length > 0 && (
          <div class="mt-5 space-y-4">
            {draft.education.map((entry, index) => (
              <EducationEditor
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
          id="add-education-entry"
          type="button"
          onClick={addEducation}
          class="mt-5 w-full rounded-2xl border border-dashed border-accent/45 bg-accent/[0.04] px-5 py-4 text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Add education
        </button>
      </section>

      <section
        aria-labelledby="skills-section-heading"
        class="mt-10 border-t border-white/10 pt-8"
      >
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Section 2
          </p>
          <h3
            id="skills-section-heading"
            class="mt-2 text-xl font-bold text-white"
          >
            Skills
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-white/60">
            Add each confirmed skill separately so it can later be matched and
            tailored without losing its meaning.
          </p>
        </div>

        {draft.skills.length > 0 && (
          <div class="mt-5 space-y-3">
            {draft.skills.map((entry, index) => (
              <SkillEditor
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
          id="add-skill-entry"
          type="button"
          onClick={addSkill}
          class="mt-5 w-full rounded-2xl border border-dashed border-accent/45 bg-accent/[0.04] px-5 py-4 text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Add skill
        </button>
      </section>

      <section
        aria-labelledby="licences-section-heading"
        class="mt-10 border-t border-white/10 pt-8"
      >
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Section 3
          </p>
          <h3
            id="licences-section-heading"
            class="mt-2 text-xl font-bold text-white"
          >
            Licences and certifications
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-white/60">
            Enter any legitimate licence, registration, or certification. The
            examples are not a fixed list.
          </p>
        </div>

        {draft.licences.length > 0 && (
          <div class="mt-5 space-y-4">
            {draft.licences.map((entry, index) => (
              <LicenceEditor
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
          id="add-licence-entry"
          type="button"
          onClick={addLicence}
          class="mt-5 w-full rounded-2xl border border-dashed border-accent/45 bg-accent/[0.04] px-5 py-4 text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Add licence or certification
        </button>
      </section>

      <div class="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          class="rounded-full border border-white/20 px-7 py-3 text-sm font-bold text-white transition hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {backLabel}
        </button>
        <button
          type="submit"
          class="rounded-full bg-accent px-7 py-3 text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {continueLabel}
        </button>
      </div>
    </form>
  );
}

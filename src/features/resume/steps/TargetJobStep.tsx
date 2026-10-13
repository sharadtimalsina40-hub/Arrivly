import type { TargetedEvent } from 'preact';
import { useState } from 'preact/hooks';
import JobAnalysisPanel from '../ai/components/JobAnalysisPanel';
import {
  JOB_AD_MAX_CHARACTERS,
  type JobAnalysisV1,
} from '../ai/job-analysis/types';
import type { OccupationProfileId, ResumeDraftV1 } from '../model/types';
import { validateResumeDraft } from '../model/validation';
import {
  classifyOccupationFromJobTitle,
  occupationProfileOptions,
} from '../occupations/registry';
import type { ResumeDraftAction } from '../state/reducer';

export interface TargetJobStepProps {
  readonly draft: ResumeDraftV1;
  readonly dispatch: (action: ResumeDraftAction) => void;
  readonly jobAnalysis?: JobAnalysisV1;
  readonly jobAnalysisStatus: JobAnalysisUiStatus;
  readonly jobAnalysisMessage?: string;
  readonly onAnalyseJob: () => void;
  readonly onBack?: () => void;
  readonly onContinue: () => void;
  readonly backLabel?: string;
  readonly continueLabel?: string;
}

export type JobAnalysisUiStatus =
  | 'idle'
  | 'analysing'
  | 'complete'
  | 'error';

const STEP_VALIDATION_FIELDS = [
  {
    path: 'targetJob.desiredTitle',
    fieldId: 'target-job-title',
  },
  {
    path: 'targetJob.jobAdvertisement.text',
    fieldId: 'target-job-advertisement',
  },
] as const;

const INPUT_CLASS =
  'w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-accent focus:outline-none';

function inputClass(hasError: boolean): string {
  return `${INPUT_CLASS} ${hasError ? 'border-red-300/80' : 'border-white/15'}`;
}

function now(): string {
  return new Date().toISOString();
}

export default function TargetJobStep({
  draft,
  dispatch,
  jobAnalysis,
  jobAnalysisStatus,
  jobAnalysisMessage,
  onAnalyseJob,
  onBack,
  onContinue,
  backLabel = 'Back',
  continueLabel = 'Continue',
}: TargetJobStepProps) {
  const [hasAttemptedContinue, setHasAttemptedContinue] = useState(false);
  const [isConfirmingJobAdRemoval, setIsConfirmingJobAdRemoval] =
    useState(false);
  const validation = hasAttemptedContinue
    ? validateResumeDraft(draft)
    : undefined;
  const jobTitleError = validation?.errors['targetJob.desiredTitle'];
  const jobAdvertisementError =
    validation?.errors['targetJob.jobAdvertisement.text'];
  const jobAdvertisement = draft.targetJob.jobAdvertisement;
  const jobAdvertisementCharacterCount =
    jobAdvertisement.status === 'provided'
      ? jobAdvertisement.text.length
      : 0;
  const jobAdvertisementExceedsAnalysisLimit =
    jobAdvertisementCharacterCount > JOB_AD_MAX_CHARACTERS;
  const canAnalyseJob =
    jobAdvertisement.status === 'provided' &&
    jobAdvertisement.text.trim().length > 0 &&
    !jobAdvertisementExceedsAnalysisLimit &&
    !isConfirmingJobAdRemoval &&
    jobAnalysisStatus !== 'analysing';

  function handleJobTitleInput(event: TargetedEvent<HTMLInputElement>) {
    const jobTitle = event.currentTarget.value;
    const timestamp = now();
    const classification = classifyOccupationFromJobTitle(jobTitle);

    dispatch({
      type: 'target-job/title-changed',
      jobTitle,
      classifiedProfileId: classification.profileId,
      at: timestamp,
    });
  }

  function handleEmployerInput(event: TargetedEvent<HTMLInputElement>) {
    const employer = event.currentTarget.value;

    dispatch({
      type: 'target-job/employer-changed',
      employer: employer === '' ? undefined : employer,
      at: now(),
    });
  }

  function handleJobAdvertisementModeChange(
    event: TargetedEvent<HTMLInputElement>,
  ) {
    if (!event.currentTarget.checked) {
      return;
    }

    if (
      event.currentTarget.value === 'not-provided' &&
      jobAdvertisement.status === 'provided' &&
      jobAdvertisement.text.trim() !== ''
    ) {
      setIsConfirmingJobAdRemoval(true);
      requestAnimationFrame(() => {
        document.getElementById('keep-job-advertisement')?.focus();
      });
      return;
    }

    setIsConfirmingJobAdRemoval(false);
    dispatch({
      type: 'target-job/job-advertisement-changed',
      jobAdvertisement:
        event.currentTarget.value === 'provided'
          ? {
              status: 'provided',
              text:
                jobAdvertisement.status === 'provided'
                  ? jobAdvertisement.text
                  : '',
            }
          : { status: 'not-provided' },
      at: now(),
    });
  }

  function handleJobAdvertisementInput(
    event: TargetedEvent<HTMLTextAreaElement>,
  ) {
    setIsConfirmingJobAdRemoval(false);
    dispatch({
      type: 'target-job/job-advertisement-changed',
      jobAdvertisement: {
        status: 'provided',
        text: event.currentTarget.value,
      },
      at: now(),
    });
  }

  function keepJobAdvertisement() {
    setIsConfirmingJobAdRemoval(false);
    requestAnimationFrame(() => {
      document.getElementById('job-advertisement-provided')?.focus();
    });
  }

  function removeJobAdvertisement() {
    setIsConfirmingJobAdRemoval(false);
    dispatch({
      type: 'target-job/job-advertisement-changed',
      jobAdvertisement: { status: 'not-provided' },
      at: now(),
    });
    requestAnimationFrame(() => {
      document.getElementById('job-advertisement-not-provided')?.focus();
    });
  }

  function handleOccupationProfileChange(
    event: TargetedEvent<HTMLSelectElement>,
  ) {
    dispatch({
      type: 'target-job/occupation-profile-changed',
      profileId: event.currentTarget.value as OccupationProfileId,
      selectedBy: 'user',
      confirmed: true,
      at: now(),
    });
  }

  function handleOccupationConfirmationChange(
    event: TargetedEvent<HTMLInputElement>,
  ) {
    dispatch({
      type: 'target-job/occupation-confirmed',
      confirmed: event.currentTarget.checked,
      at: now(),
    });
  }

  function handleSubmit(
    event: TargetedEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    setHasAttemptedContinue(true);

    if (isConfirmingJobAdRemoval) {
      requestAnimationFrame(() => {
        document.getElementById('keep-job-advertisement')?.focus();
      });
      return;
    }

    const result = validateResumeDraft(draft);
    const firstInvalidField = STEP_VALIDATION_FIELDS.find(
      ({ path }) => result.errors[path] !== undefined,
    );

    if (firstInvalidField) {
      requestAnimationFrame(() => {
        document.getElementById(firstInvalidField.fieldId)?.focus();
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
      aria-labelledby="target-job-step-heading"
    >
      <p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
        Step 1 of 6
      </p>
      <h2
        id="target-job-step-heading"
        tabIndex={-1}
        class="mb-3 font-serif text-2xl font-light tracking-tight text-white sm:text-3xl"
      >
        Target job
      </h2>
      <p class="mb-8 max-w-xl text-sm leading-relaxed text-white/70">
        Tell us about the role you are applying for. This information guides
        the questionnaire but never becomes evidence about your experience.
      </p>

      <div class="space-y-7">
        <div>
          <label
            for="target-job-title"
            class="mb-2 block text-sm font-medium text-white"
          >
            Job title <span class="text-accent">(required)</span>
          </label>
          <input
            id="target-job-title"
            type="text"
            value={draft.targetJob.desiredTitle}
            onInput={handleJobTitleInput}
            placeholder="Cafe All-Rounder"
            required
            aria-invalid={Boolean(jobTitleError)}
            aria-describedby={
              jobTitleError
                ? 'target-job-title-help target-job-title-error'
                : 'target-job-title-help'
            }
            class={inputClass(Boolean(jobTitleError))}
          />
          <p id="target-job-title-help" class="mt-2 text-xs leading-relaxed text-white/60">
            Use the title from the advertisement when you have one.
          </p>
          {jobTitleError && (
            <p
              id="target-job-title-error"
              class="mt-2 text-sm font-medium text-red-200"
            >
              {jobTitleError}
            </p>
          )}
        </div>

        <div>
          <label
            for="target-job-employer"
            class="mb-2 block text-sm font-medium text-white"
          >
            Employer <span class="text-white/55">(optional)</span>
          </label>
          <input
            id="target-job-employer"
            type="text"
            value={draft.targetJob.employer ?? ''}
            onInput={handleEmployerInput}
            placeholder="Harbour Cafe"
            class={inputClass(false)}
          />
        </div>

        <fieldset>
          <legend class="mb-3 text-sm font-medium text-white">
            Do you have the job advertisement?
          </legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <label
              class={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                jobAdvertisement.status === 'provided'
                  ? 'border-accent/70 bg-accent/[0.08] text-white'
                  : 'border-white/15 bg-white/[0.04] text-white/75 hover:border-white/30'
              }`}
            >
              <input
                id="job-advertisement-provided"
                type="radio"
                name="job-advertisement-mode"
                value="provided"
                checked={jobAdvertisement.status === 'provided'}
                onChange={handleJobAdvertisementModeChange}
                class="h-4 w-4 shrink-0 accent-accent"
              />
              <span>I have the job ad</span>
            </label>

            <label
              class={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                jobAdvertisement.status === 'not-provided'
                  ? 'border-accent/70 bg-accent/[0.08] text-white'
                  : 'border-white/15 bg-white/[0.04] text-white/75 hover:border-white/30'
              }`}
            >
              <input
                id="job-advertisement-not-provided"
                type="radio"
                name="job-advertisement-mode"
                value="not-provided"
                checked={jobAdvertisement.status === 'not-provided'}
                onChange={handleJobAdvertisementModeChange}
                class="h-4 w-4 shrink-0 accent-accent"
              />
              <span>I don&apos;t have the job ad</span>
            </label>
          </div>
        </fieldset>

        {isConfirmingJobAdRemoval && (
          <div
            id="job-advertisement-removal-warning"
            role="alert"
            class="rounded-2xl border border-amber-200/40 bg-amber-200/[0.08] p-4"
          >
            <p class="text-sm font-medium text-white">
              Remove the pasted job advertisement?
            </p>
            <p class="mt-2 text-xs leading-relaxed text-white/70">
              Selecting “I don&apos;t have the job ad” will permanently remove
              the text currently stored in this draft.
            </p>
            <div class="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                id="keep-job-advertisement"
                type="button"
                onClick={keepJobAdvertisement}
                class="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink"
              >
                Keep job ad
              </button>
              <button
                type="button"
                onClick={removeJobAdvertisement}
                class="rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white"
              >
                Remove job ad
              </button>
            </div>
          </div>
        )}

        {jobAdvertisement.status === 'provided' && (
          <div>
            <label
              for="target-job-advertisement"
              class="mb-2 block text-sm font-medium text-white"
            >
              Job advertisement <span class="text-accent">(required)</span>
            </label>
            <textarea
              id="target-job-advertisement"
              rows={9}
              value={jobAdvertisement.text}
              onInput={handleJobAdvertisementInput}
              placeholder="Paste the complete job advertisement here"
              required
              aria-invalid={Boolean(jobAdvertisementError)}
              aria-describedby={
                jobAdvertisementError
                  ? 'target-job-advertisement-help job-analysis-input-limit target-job-advertisement-error'
                  : 'target-job-advertisement-help job-analysis-input-limit'
              }
              class={`${inputClass(Boolean(jobAdvertisementError))} min-h-48 resize-y leading-relaxed`}
            />
            <p
              id="target-job-advertisement-help"
              class="mt-2 text-xs leading-relaxed text-white/60"
            >
              This is employer context only. It will never be treated as proof
              that you have a skill or qualification.
            </p>
            <p
              id="job-analysis-input-limit"
              class={`mt-2 text-xs leading-relaxed ${
                jobAdvertisementExceedsAnalysisLimit
                  ? 'font-medium text-red-200'
                  : 'text-white/55'
              }`}
            >
              {jobAdvertisementCharacterCount.toLocaleString('en-AU')} of{' '}
              {JOB_AD_MAX_CHARACTERS.toLocaleString('en-AU')} characters for
              analysis.
            </p>
            {jobAdvertisementError && (
              <p
                id="target-job-advertisement-error"
                class="mt-2 text-sm font-medium text-red-200"
              >
                {jobAdvertisementError}
              </p>
            )}

            <div
              class="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              aria-busy={jobAnalysisStatus === 'analysing'}
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-sm font-medium text-white">
                    Extract employer requirements
                  </p>
                  <p
                    id="job-analysis-action-help"
                    class="mt-1 text-xs leading-relaxed text-white/60"
                  >
                    Analysis runs only when you choose it and never changes
                    your resume facts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onAnalyseJob}
                  disabled={!canAnalyseJob}
                  aria-describedby={
                    jobAnalysisStatus === 'idle'
                      ? 'job-analysis-action-help job-analysis-input-limit'
                      : 'job-analysis-action-help job-analysis-input-limit job-analysis-request-status'
                  }
                  aria-controls={
                    import.meta.env.DEV &&
                    jobAnalysisStatus === 'complete' &&
                    jobAnalysis
                      ? 'job-analysis-development-panel'
                      : undefined
                  }
                  class="min-h-11 shrink-0 rounded-full border border-accent/55 px-5 py-2.5 text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {jobAnalysisStatus === 'analysing'
                    ? 'Analysing…'
                    : 'Analyse job'}
                </button>
              </div>

              {jobAnalysisStatus !== 'idle' && (
                <p
                  id="job-analysis-request-status"
                  role={jobAnalysisStatus === 'error' ? 'alert' : 'status'}
                  aria-live={
                    jobAnalysisStatus === 'error' ? 'assertive' : 'polite'
                  }
                  class={`mt-3 text-sm leading-relaxed ${
                    jobAnalysisStatus === 'error'
                      ? 'text-red-200'
                      : 'text-white/70'
                  }`}
                >
                  {jobAnalysisStatus === 'analysing'
                    ? 'Analysing the current job advertisement…'
                    : jobAnalysisMessage}
                </p>
              )}
            </div>

            {import.meta.env.DEV &&
              jobAnalysisStatus === 'complete' &&
              jobAnalysis && (
                <JobAnalysisPanel analysis={jobAnalysis} />
              )}
          </div>
        )}

        <div class="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <label
            for="target-job-occupation"
            class="mb-2 block text-sm font-medium text-white"
          >
            Occupation category
          </label>
          <select
            id="target-job-occupation"
            value={draft.targetJob.occupation.profileId}
            onChange={handleOccupationProfileChange}
            class={inputClass(false)}
          >
            {occupationProfileOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p class="mt-2 text-xs leading-relaxed text-white/60">
            This selects relevant questions. It does not add claims to your
            resume.
          </p>

          <label class="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-white/75">
            <input
              type="checkbox"
              checked={draft.targetJob.occupation.confirmed}
              onChange={handleOccupationConfirmationChange}
              class="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span>This category is the closest match for my target role.</span>
          </label>
        </div>
      </div>

      <div
        class={`mt-8 flex border-t border-white/10 pt-6 ${
          onBack
            ? 'flex-col gap-3 sm:flex-row sm:justify-between'
            : 'justify-end'
        }`}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            class="rounded-full border border-white/20 px-7 py-3 text-sm font-bold text-white transition hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {backLabel}
          </button>
        )}
        <button
          type="submit"
          class="w-full rounded-full bg-accent px-7 py-3 text-sm font-bold text-ink transition hover:brightness-105 sm:w-auto"
        >
          {continueLabel}
        </button>
      </div>
    </form>
  );
}

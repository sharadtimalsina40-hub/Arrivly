import type { TargetedEvent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { createAdaptiveAnswer } from '../model/defaults';
import type {
  AdaptiveAnswer,
  AdaptiveAnswerValue,
  OccupationProfileId,
  ResumeDraftV1,
} from '../model/types';
import { validateResumeDraft } from '../model/validation';
import {
  classifyOccupationFromJobTitle,
  getOccupationProfile,
  occupationProfileOptions,
} from '../occupations/registry';
import type { OccupationQuestionDefinition } from '../occupations/types';
import type { ResumeDraftAction } from '../state/reducer';

export interface AdaptiveQuestionsStepProps {
  readonly draft: ResumeDraftV1;
  readonly dispatch: (action: ResumeDraftAction) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly backLabel?: string;
  readonly continueLabel?: string;
}

interface AdaptiveQuestionFieldProps {
  readonly question: OccupationQuestionDefinition;
  readonly answer: AdaptiveAnswer | undefined;
  readonly onAnswer: (answer: AdaptiveAnswerValue) => void;
  readonly onClear: () => void;
}

const INPUT_CLASS =
  'w-full rounded-xl border border-white/40 bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/65 focus:border-accent focus:outline-none';

const CHOICE_CLASS =
  'flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-white/30 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/80 transition hover:border-white/45 focus-within:border-accent';

function now(): string {
  return new Date().toISOString();
}

function questionControlId(
  question: OccupationQuestionDefinition,
  optionValue?: string,
): string {
  return optionValue
    ? `adaptive-${question.id}-${optionValue}`
    : `adaptive-${question.id}`;
}

function firstQuestionControlId(
  question: OccupationQuestionDefinition,
): string {
  if (question.type === 'boolean') {
    return questionControlId(question, 'yes');
  }

  if (
    (question.type === 'single-select' ||
      question.type === 'multi-select') &&
    question.options[0]
  ) {
    return questionControlId(question, question.options[0].value);
  }

  return questionControlId(question);
}

function AdaptiveQuestionField({
  question,
  answer,
  onAnswer,
  onClear,
}: AdaptiveQuestionFieldProps) {
  const helpId = question.helpText
    ? `adaptive-${question.id}-help`
    : undefined;
  const booleanValue =
    answer?.answer.kind === 'boolean' ? answer.answer.value : undefined;
  const textValue =
    answer?.answer.kind === 'text' ? answer.answer.value : '';
  const singleValue =
    answer?.answer.kind === 'single-choice' ? answer.answer.value : undefined;
  const multipleValues =
    answer?.answer.kind === 'multiple-choice' ? answer.answer.value : [];

  function clearAndRefocus() {
    onClear();
    requestAnimationFrame(() => {
      document.getElementById(firstQuestionControlId(question))?.focus();
    });
  }

  return (
    <div class="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      {question.type === 'boolean' ? (
        <fieldset aria-describedby={helpId}>
          <legend class="text-sm font-medium leading-relaxed text-white">
            {question.label}{' '}
            <span class="text-white/50">(optional)</span>
          </legend>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <label class={CHOICE_CLASS}>
              <input
                id={questionControlId(question, 'yes')}
                type="radio"
                name={`adaptive-${question.profileId}-${question.id}`}
                checked={booleanValue === true}
                onChange={(event) => {
                  if (event.currentTarget.checked) {
                    onAnswer({ kind: 'boolean', value: true });
                  }
                }}
                class="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span>Yes</span>
            </label>
            <label class={CHOICE_CLASS}>
              <input
                id={questionControlId(question, 'no')}
                type="radio"
                name={`adaptive-${question.profileId}-${question.id}`}
                checked={booleanValue === false}
                onChange={(event) => {
                  if (event.currentTarget.checked) {
                    onAnswer({ kind: 'boolean', value: false });
                  }
                }}
                class="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span>No</span>
            </label>
          </div>
        </fieldset>
      ) : question.type === 'text' ? (
        <div>
          <label
            for={questionControlId(question)}
            class="mb-2 block text-sm font-medium leading-relaxed text-white"
          >
            {question.label}{' '}
            <span class="text-white/50">(optional)</span>
          </label>
          {question.multiline ? (
            <textarea
              id={questionControlId(question)}
              rows={4}
              value={textValue}
              onInput={(event) => {
                const value = event.currentTarget.value;
                value.trim()
                  ? onAnswer({ kind: 'text', value })
                  : onClear();
              }}
              placeholder={question.placeholder}
              aria-describedby={helpId}
              class={`${INPUT_CLASS} resize-y leading-relaxed`}
            />
          ) : (
            <input
              id={questionControlId(question)}
              type="text"
              value={textValue}
              onInput={(event) => {
                const value = event.currentTarget.value;
                value.trim()
                  ? onAnswer({ kind: 'text', value })
                  : onClear();
              }}
              placeholder={question.placeholder}
              aria-describedby={helpId}
              class={INPUT_CLASS}
            />
          )}
        </div>
      ) : question.type === 'single-select' ? (
        <fieldset aria-describedby={helpId}>
          <legend class="text-sm font-medium leading-relaxed text-white">
            {question.label}{' '}
            <span class="text-white/50">(optional)</span>
          </legend>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            {question.options.map((option) => (
              <label key={option.value} class={CHOICE_CLASS}>
                <input
                  id={questionControlId(question, option.value)}
                  type="radio"
                  name={`adaptive-${question.profileId}-${question.id}`}
                  checked={singleValue === option.value}
                  onChange={(event) => {
                    if (event.currentTarget.checked) {
                      onAnswer({
                        kind: 'single-choice',
                        value: option.value,
                      });
                    }
                  }}
                  class="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                />
                <span class="min-w-0 break-words">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset aria-describedby={helpId}>
          <legend class="text-sm font-medium leading-relaxed text-white">
            {question.label}{' '}
            <span class="text-white/50">(optional)</span>
          </legend>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            {question.options.map((option) => {
              const isChecked = multipleValues.includes(option.value);

              return (
                <label key={option.value} class={CHOICE_CLASS}>
                  <input
                    id={questionControlId(question, option.value)}
                    type="checkbox"
                    checked={isChecked}
                    onChange={(event) => {
                      const selectedValues = new Set(multipleValues);

                      if (event.currentTarget.checked) {
                        selectedValues.add(option.value);
                      } else {
                        selectedValues.delete(option.value);
                      }

                      const nextValues = question.options
                        .filter((candidate) =>
                          selectedValues.has(candidate.value),
                        )
                        .map((candidate) => candidate.value);

                      nextValues.length > 0
                        ? onAnswer({
                            kind: 'multiple-choice',
                            value: nextValues,
                          })
                        : onClear();
                    }}
                    class="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                  />
                  <span class="min-w-0 break-words">{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {question.helpText && (
        <p
          id={`adaptive-${question.id}-help`}
          class="mt-3 text-xs leading-relaxed text-white/55"
        >
          {question.helpText}
        </p>
      )}

      {answer && (
        <button
          type="button"
          onClick={clearAndRefocus}
          class="mt-3 rounded-lg px-2 py-1 text-xs font-bold text-white/60 underline decoration-white/25 underline-offset-4 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={`Clear answer for: ${question.label}`}
        >
          Clear answer
        </button>
      )}
    </div>
  );
}

export default function AdaptiveQuestionsStep({
  draft,
  dispatch,
  onBack,
  onContinue,
  backLabel = 'Back',
  continueLabel = 'Continue',
}: AdaptiveQuestionsStepProps) {
  const classification = classifyOccupationFromJobTitle(
    draft.targetJob.desiredTitle,
  );
  const occupation = draft.targetJob.occupation;
  const effectiveProfileId =
    occupation.selectedBy === 'rule' && !occupation.confirmed
      ? classification.profileId
      : occupation.profileId;
  const profile = getOccupationProfile(effectiveProfileId);
  const questions = profile.groups.flatMap((group) => group.questions);
  const activeAnswers = draft.adaptiveAnswers.filter(
    (answer) => answer.occupationProfileId === effectiveProfileId,
  );
  const answerByQuestionId = new Map(
    activeAnswers.map((answer) => [answer.questionId, answer]),
  );
  const answeredCount = questions.filter((question) =>
    answerByQuestionId.has(question.id),
  ).length;
  const hiddenAnswerCount = draft.adaptiveAnswers.length - activeAnswers.length;
  const [hasAttemptedContinue, setHasAttemptedContinue] = useState(false);
  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [pendingProfileId, setPendingProfileId] =
    useState<OccupationProfileId>(effectiveProfileId);
  const [profileNotice, setProfileNotice] = useState('');
  const confirmationError = hasAttemptedContinue
    ? validateResumeDraft(draft).errors['targetJob.occupation.confirmed']
    : undefined;
  const pendingCategoryError =
    hasAttemptedContinue && isChangingCategory
      ? 'Use the selected category or cancel this change before continuing'
      : undefined;

  useEffect(() => {
    if (
      occupation.selectedBy === 'rule' &&
      !occupation.confirmed &&
      occupation.profileId !== classification.profileId
    ) {
      dispatch({
        type: 'target-job/occupation-profile-changed',
        profileId: classification.profileId,
        selectedBy: 'rule',
        confirmed: false,
        at: now(),
      });
    }
  }, [
    classification.profileId,
    dispatch,
    occupation.confirmed,
    occupation.profileId,
    occupation.selectedBy,
  ]);

  useEffect(() => {
    if (!isChangingCategory) {
      setPendingProfileId(effectiveProfileId);
    }
  }, [effectiveProfileId, isChangingCategory]);

  function upsertAnswer(
    question: OccupationQuestionDefinition,
    answerValue: AdaptiveAnswerValue,
  ) {
    const existingAnswer = answerByQuestionId.get(question.id);
    const answer = existingAnswer
      ? {
          ...existingAnswer,
          answer: answerValue,
          confirmed: true,
        }
      : createAdaptiveAnswer(
          question.id,
          effectiveProfileId,
          answerValue,
        );

    dispatch({
      type: 'adaptive-answer/upserted',
      answer,
      at: now(),
    });
  }

  function clearAnswer(questionId: string) {
    const existingAnswer = answerByQuestionId.get(questionId);

    if (!existingAnswer) {
      return;
    }

    dispatch({
      type: 'adaptive-answer/removed',
      answerId: existingAnswer.id,
      at: now(),
    });
  }

  function confirmSuggestedProfile() {
    dispatch({
      type: 'target-job/occupation-profile-changed',
      profileId: effectiveProfileId,
      selectedBy: occupation.selectedBy,
      confirmed: true,
      at: now(),
    });
    setHasAttemptedContinue(false);
    setProfileNotice(`${profile.label} confirmed. Relevant questions are now available.`);

    requestAnimationFrame(() => {
      document.getElementById('adaptive-question-set-heading')?.focus();
    });
  }

  function beginCategoryChange() {
    setPendingProfileId(effectiveProfileId);
    setIsChangingCategory(true);
    requestAnimationFrame(() => {
      document.getElementById('adaptive-occupation-category')?.focus();
    });
  }

  function cancelCategoryChange() {
    setPendingProfileId(effectiveProfileId);
    setIsChangingCategory(false);
    requestAnimationFrame(() => {
      document.getElementById('change-adaptive-occupation')?.focus();
    });
  }

  function useSelectedCategory() {
    const previousProfile = getOccupationProfile(effectiveProfileId);
    const nextProfile = getOccupationProfile(pendingProfileId);
    const preservedAnswerCount = draft.adaptiveAnswers.filter(
      (answer) => answer.occupationProfileId === effectiveProfileId,
    ).length;

    dispatch({
      type: 'target-job/occupation-profile-changed',
      profileId: pendingProfileId,
      selectedBy: 'user',
      confirmed: true,
      at: now(),
    });
    setHasAttemptedContinue(false);
    setIsChangingCategory(false);
    setProfileNotice(
      pendingProfileId === effectiveProfileId
        ? `${nextProfile.label} confirmed.`
        : `${nextProfile.label} selected. ${
            preservedAnswerCount > 0
              ? `${preservedAnswerCount} ${previousProfile.label} answer${
                  preservedAnswerCount === 1 ? ' is' : 's are'
                } saved and hidden.`
              : `No ${previousProfile.label} answers had been entered.`
          }`,
    );

    requestAnimationFrame(() => {
      document.getElementById('adaptive-question-set-heading')?.focus();
    });
  }

  function handleSubmit(
    event: TargetedEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    setHasAttemptedContinue(true);

    if (isChangingCategory) {
      requestAnimationFrame(() => {
        document.getElementById('use-adaptive-occupation')?.focus();
      });
      return;
    }

    if (!draft.targetJob.occupation.confirmed) {
      requestAnimationFrame(() => {
        document.getElementById('confirm-adaptive-occupation')?.focus();
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
      aria-labelledby="adaptive-questions-step-heading"
    >
      <p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
        Step 5 of 6
      </p>
      <h2
        id="adaptive-questions-step-heading"
        tabIndex={-1}
        class="mb-3 font-serif text-2xl font-light tracking-tight text-white sm:text-3xl"
      >
        Questions for your target role
      </h2>
      <p class="mb-8 max-w-xl text-sm leading-relaxed text-white/70">
        These optional questions collect information you explicitly confirm.
        Job-ad requirements never become answers about you.
      </p>

      <section
        aria-labelledby="adaptive-occupation-heading"
        class="rounded-2xl border border-accent/30 bg-accent/[0.055] p-5 sm:p-6"
      >
        <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          Occupation category
        </p>
        <h3
          id="adaptive-occupation-heading"
          class="mt-2 text-xl font-bold text-white"
        >
          {occupation.selectedBy === 'user'
            ? 'You selected:'
            : classification.status === 'matched'
              ? 'We think this role is:'
              : 'We could not confidently classify this title:'}
        </h3>
        <p class="mt-3 font-serif text-2xl text-white">{profile.label}</p>
        <p class="mt-3 text-sm leading-relaxed text-white/65">
          {classification.status === 'matched' && occupation.selectedBy === 'rule'
            ? 'This is a rule-based suggestion from the job title only.'
            : classification.status === 'ambiguous' && occupation.selectedBy === 'rule'
              ? 'The title matched more than one category, so general questions are safer.'
              : classification.status === 'fallback' && occupation.selectedBy === 'rule'
                ? 'General questions are used when no transparent title rule matches.'
                : 'Your manual choice takes priority over the rule-based suggestion.'}
        </p>

        {!occupation.confirmed && (
          <button
            id="confirm-adaptive-occupation"
            type="button"
            onClick={confirmSuggestedProfile}
            aria-describedby={
              confirmationError ? 'adaptive-occupation-error' : undefined
            }
            class="mt-5 w-full rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
          >
            Yes, that&apos;s right
          </button>
        )}

        {confirmationError && (
          <p
            id="adaptive-occupation-error"
            class="mt-3 text-sm font-medium text-red-200"
          >
            {confirmationError}
          </p>
        )}

        {!isChangingCategory ? (
          <button
            id="change-adaptive-occupation"
            type="button"
            onClick={beginCategoryChange}
            class="mt-4 block rounded-lg text-sm font-bold text-white underline decoration-white/30 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Change category
          </button>
        ) : (
          <div class="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
            <label
              for="adaptive-occupation-category"
              class="mb-2 block text-sm font-medium text-white"
            >
              Choose the closest category
            </label>
            <select
              id="adaptive-occupation-category"
              value={pendingProfileId}
              onChange={(event) =>
                setPendingProfileId(
                  event.currentTarget.value as OccupationProfileId,
                )
              }
              class={INPUT_CLASS}
            >
              {occupationProfileOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p class="mt-2 text-xs leading-relaxed text-white/55">
              Answers from another category stay saved under that category and
              return if you switch back.
            </p>
            <div class="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                id="use-adaptive-occupation"
                type="button"
                onClick={useSelectedCategory}
                aria-describedby={
                  pendingCategoryError
                    ? 'adaptive-pending-category-error'
                    : undefined
                }
                class="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink"
              >
                Use this category
              </button>
              <button
                type="button"
                onClick={cancelCategoryChange}
                class="rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white"
              >
                Cancel
              </button>
            </div>
            {pendingCategoryError && (
              <p
                id="adaptive-pending-category-error"
                class="mt-3 text-sm font-medium text-red-200"
              >
                {pendingCategoryError}
              </p>
            )}
          </div>
        )}
      </section>

      <p
        aria-live="polite"
        class="mt-4 min-h-5 text-sm leading-relaxed text-white/65"
      >
        {profileNotice}
      </p>

      {occupation.confirmed && (
        <section class="mt-7" aria-labelledby="adaptive-question-set-heading">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3
                id="adaptive-question-set-heading"
                tabIndex={-1}
                class="text-xl font-bold text-white"
              >
                {profile.label} questions
              </h3>
              <p class="mt-2 text-sm leading-relaxed text-white/60">
                Answer only what you know to be accurate. Every question is
                optional.
              </p>
            </div>
            <p class="text-xs font-bold uppercase tracking-[0.12em] text-white/50">
              {answeredCount} of {questions.length} answered
            </p>
          </div>

          {hiddenAnswerCount > 0 && (
            <p class="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/60">
              {hiddenAnswerCount} answer{hiddenAnswerCount === 1 ? ' is' : 's are'}
              {' '}saved under another category and hidden here.
            </p>
          )}

          <div class="mt-6 space-y-6">
            {profile.groups.map((group) => (
              <section
                key={group.id}
                aria-labelledby={`adaptive-group-${group.id}`}
                class="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
              >
                <h4
                  id={`adaptive-group-${group.id}`}
                  class="text-base font-bold text-white"
                >
                  {group.title}
                </h4>
                {group.description && (
                  <p class="mt-2 text-xs leading-relaxed text-white/55">
                    {group.description}
                  </p>
                )}
                <div class="mt-4 space-y-4">
                  {group.questions.map((question) => (
                    <AdaptiveQuestionField
                      key={question.id}
                      question={question}
                      answer={answerByQuestionId.get(question.id)}
                      onAnswer={(answerValue) =>
                        upsertAnswer(question, answerValue)
                      }
                      onClear={() => clearAnswer(question.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div class="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-white/60">
            These answers remain structured questionnaire data. They do not
            automatically create skills, licences, achievements, or resume
            bullets.
          </div>
        </section>
      )}

      <div class="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
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

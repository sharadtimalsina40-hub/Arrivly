import type { TargetedEvent } from 'preact';
import { useState } from 'preact/hooks';
import type { JobMatchResult, MatchStatus } from '../matching/types';
import { getFollowUpExpiryIssue } from './evidence';
import type { FollowUpAction } from './reducer';
import type {
  FollowUpAnswer,
  FollowUpQuestion,
  FollowUpQuestionBatch,
  FollowUpResponse,
  FollowUpState,
} from './types';

export interface FollowUpQuestionsProps {
  readonly batch: FollowUpQuestionBatch;
  readonly state: FollowUpState;
  readonly matchResult: JobMatchResult;
  readonly asOfYearMonth: string;
  readonly dispatch: (action: FollowUpAction) => void;
}

const PRIORITY_LABEL = {
  required: 'Required',
  preferred: 'Preferred',
  unspecified: 'Other advertised criterion',
} as const;

const MATCH_STATUS_LABEL: Readonly<Record<MatchStatus, string>> = {
  matched: 'Matched',
  related: 'Related evidence',
  unresolved: 'Needs confirmation',
  'confirmed-missing': 'Confirmed missing',
};

const ANSWER_STATUS_LABEL: Readonly<
  Record<FollowUpAnswer['status'], string>
> = {
  unanswered: 'Not saved',
  confirmed: 'Yes — confirmed by you',
  declined: 'No — confirmed by you',
  uncertain: 'Not confirmed',
  skipped: 'Skipped for now',
};

const RESPONSE_OPTIONS: readonly {
  value: FollowUpResponse;
  label: string;
}[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not-sure', label: 'Not sure' },
];

function answerFor(
  state: FollowUpState,
  questionId: string,
): FollowUpAnswer | undefined {
  return state.answers.find((answer) => answer.questionId === questionId);
}

function isHandled(answer: FollowUpAnswer | undefined): boolean {
  return Boolean(answer && answer.status !== 'unanswered');
}

function responseLabel(response: FollowUpResponse): string {
  return response === 'depends'
    ? 'Sometimes / depends'
    : RESPONSE_OPTIONS.find((option) => option.value === response)?.label ??
        response;
}

function questionInputId(question: FollowUpQuestion, response: string) {
  return `${question.id}-${response}`;
}

export default function FollowUpQuestions({
  batch,
  state,
  matchResult,
  asOfYearMonth,
  dispatch,
}: FollowUpQuestionsProps) {
  const [attemptedQuestionId, setAttemptedQuestionId] = useState<
    string | null
  >(null);
  const [announcement, setAnnouncement] = useState('');
  const { questions } = batch;
  const explicitlyActive = questions.find(
    (question) => question.id === state.activeQuestionId,
  );
  const firstUnhandled = questions.find(
    (question) => !isHandled(answerFor(state, question.id)),
  );
  const allHandled =
    questions.length > 0 &&
    questions.every((question) => isHandled(answerFor(state, question.id)));
  const currentQuestion = explicitlyActive ?? (allHandled ? undefined : firstUnhandled);
  const currentIndex = currentQuestion
    ? questions.findIndex((question) => question.id === currentQuestion.id)
    : -1;
  const currentAnswer = currentQuestion
    ? answerFor(state, currentQuestion.id)
    : undefined;
  const responseError =
    currentQuestion &&
    attemptedQuestionId === currentQuestion.id &&
    !currentAnswer?.response
      ? 'Choose an answer before saving, or skip this question for now.'
      : undefined;
  const currentExpiryIssue =
    currentQuestion?.kind === 'licence-certification' &&
    currentAnswer?.response === 'yes' &&
    currentAnswer.expiryDate
      ? getFollowUpExpiryIssue(
          currentAnswer.expiryDate,
          asOfYearMonth,
        )
      : undefined;
  const expiryError =
    currentQuestion &&
    attemptedQuestionId === currentQuestion.id &&
    currentExpiryIssue
      ? currentExpiryIssue === 'past'
        ? 'This expiry month is in the past. Confirm the date or choose a different answer.'
        : 'Enter the expiry as a valid month and year.'
      : undefined;
  const allComparableRequirementsResolved =
    matchResult.matches.length > 0 &&
    matchResult.matches.every(
      (match) =>
        match.status === 'matched' ||
        match.status === 'confirmed-missing',
    );

  function goToQuestion(questionId: string | null) {
    setAttemptedQuestionId(null);
    dispatch({ type: 'navigation/question-changed', questionId });
    if (questionId) {
      requestAnimationFrame(() => {
        document
          .getElementById(`${questionId}-heading`)
          ?.focus();
      });
    }
  }

  function nextQuestionId(): string | null {
    if (currentIndex < 0) {
      return null;
    }

    return (
      questions
        .slice(currentIndex + 1)
        .find((question) => !isHandled(answerFor(state, question.id)))?.id ??
      null
    );
  }

  function handleSubmit(
    event: TargetedEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();

    if (!currentQuestion || !currentAnswer?.response) {
      if (currentQuestion) {
        setAttemptedQuestionId(currentQuestion.id);
        requestAnimationFrame(() => {
          document
            .getElementById(questionInputId(currentQuestion, 'yes'))
            ?.focus();
        });
      }
      return;
    }

    if (
      currentQuestion.kind === 'licence-certification' &&
      currentAnswer.response === 'yes' &&
      currentAnswer.expiryDate &&
      getFollowUpExpiryIssue(
        currentAnswer.expiryDate,
        asOfYearMonth,
      )
    ) {
      setAttemptedQuestionId(currentQuestion.id);
      requestAnimationFrame(() => {
        document.getElementById(`${currentQuestion.id}-expiry`)?.focus();
      });
      return;
    }

    const nextId = nextQuestionId();
    dispatch({
      type: 'answer/committed',
      questionId: currentQuestion.id,
      nextQuestionId: nextId,
    });
    setAttemptedQuestionId(null);
    setAnnouncement(
      `${currentQuestion.requirement}: ${responseLabel(
        currentAnswer.response,
      )} saved. Matching updated.`,
    );

    if (nextId) {
      requestAnimationFrame(() => {
        document.getElementById(`${nextId}-heading`)?.focus();
      });
    } else {
      requestAnimationFrame(() => {
        document.getElementById('follow-up-summary-heading')?.focus();
      });
    }
  }

  function skipCurrentQuestion() {
    if (!currentQuestion) {
      return;
    }

    const nextId = nextQuestionId();
    dispatch({
      type: 'answer/skipped',
      questionId: currentQuestion.id,
      nextQuestionId: nextId,
    });
    setAttemptedQuestionId(null);
    setAnnouncement(
      `${currentQuestion.requirement} skipped. No candidate evidence was created.`,
    );

    if (nextId) {
      requestAnimationFrame(() => {
        document.getElementById(`${nextId}-heading`)?.focus();
      });
    } else {
      requestAnimationFrame(() => {
        document.getElementById('follow-up-summary-heading')?.focus();
      });
    }
  }

  if (questions.length === 0) {
    return (
      <section
        aria-labelledby="follow-up-heading"
        class="mb-5 rounded-3xl border border-accent/25 bg-accent/[0.045] p-5 sm:p-6"
      >
        <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          Improve this resume
        </p>
        <h3
          id="follow-up-heading"
          class="mt-2 font-serif text-xl font-light text-white sm:text-2xl"
        >
          {allComparableRequirementsResolved
            ? 'Great — no follow-up questions are needed'
            : 'No safe follow-up questions to ask right now'}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-white/65">
          {allComparableRequirementsResolved
            ? 'We have confirmed information or an explicit answer for each comparable requirement.'
            : 'The analysis may not have extracted comparable requirements, or a requirement may need a profile correction rather than a simple Yes or No answer.'}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="follow-up-heading"
      class="mb-5 rounded-3xl border border-accent/25 bg-accent/[0.045] p-5 sm:p-6"
    >
      <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Improve this resume
      </p>
      <h3
        id="follow-up-heading"
        class="mt-2 font-serif text-xl font-light text-white sm:text-2xl"
      >
        {questions.length} important{' '}
        {questions.length === 1 ? 'question' : 'questions'}
      </h3>
      <p class="mt-2 text-sm leading-relaxed text-white/65">
        The employer asks for a few things you have not told us about yet. Your
        answers stay with this job application and do not change your master
        resume.
      </p>
      {batch.truncated && (
        <p class="mt-2 text-xs leading-relaxed text-white/55">
          Showing the first {questions.length} of {batch.totalEligible} possible
          questions, with required items first.
        </p>
      )}

      <p role="status" aria-live="polite" class="sr-only">
        {announcement}
      </p>

      {currentQuestion ? (
        <form onSubmit={handleSubmit} class="mt-6">
          <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
            Question {currentIndex + 1} of {questions.length} ·{' '}
            {PRIORITY_LABEL[currentQuestion.priority]}
          </p>
          <fieldset
            aria-describedby={responseError ? `${currentQuestion.id}-error` : undefined}
            class="mt-3 min-w-0"
          >
            <legend
              id={`${currentQuestion.id}-heading`}
              tabIndex={-1}
              class="text-lg font-bold leading-snug text-white sm:text-xl"
            >
              {currentQuestion.question}
            </legend>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ...RESPONSE_OPTIONS,
                ...(currentQuestion.allowsDepends
                  ? [{ value: 'depends' as const, label: 'Sometimes / depends' }]
                  : []),
              ].map((option) => {
                const inputId = questionInputId(
                  currentQuestion,
                  option.value,
                );

                return (
                  <label
                    key={option.value}
                    for={inputId}
                    class="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/30 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/80 transition hover:border-white/50 focus-within:border-accent focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={`${currentQuestion.id}-response`}
                      value={option.value}
                      checked={currentAnswer?.response === option.value}
                      onChange={() => {
                        setAttemptedQuestionId(null);
                        dispatch({
                          type: 'answer/response-changed',
                          questionId: currentQuestion.id,
                          response: option.value,
                        });
                      }}
                      class="h-4 w-4 shrink-0 accent-current"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {responseError && (
            <p
              id={`${currentQuestion.id}-error`}
              role="alert"
              class="mt-3 text-sm text-red-200"
            >
              {responseError}
            </p>
          )}

          {(currentAnswer?.response === 'yes' ||
            (currentQuestion.kind === 'availability' &&
              currentAnswer?.response === 'depends')) && (
            <div class="mt-5 space-y-4 rounded-2xl border border-white/12 bg-black/15 p-4">
              <div>
                <label
                  for={`${currentQuestion.id}-details`}
                  class="block text-sm font-bold text-white"
                >
                  {currentQuestion.detailsPrompt}{' '}
                  <span class="font-normal text-white/55">(optional)</span>
                </label>
                <textarea
                  id={`${currentQuestion.id}-details`}
                  rows={3}
                  maxLength={2_000}
                  value={currentAnswer.details}
                  onInput={(event) =>
                    dispatch({
                      type: 'answer/details-changed',
                      questionId: currentQuestion.id,
                      details: event.currentTarget.value,
                    })
                  }
                  class="mt-2 w-full rounded-xl border border-white/35 bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/65 focus:border-accent focus:outline-none"
                  placeholder="Add only facts you can personally confirm"
                />
              </div>

              {currentQuestion.kind === 'licence-certification' &&
                currentAnswer.response === 'yes' && (
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      for={`${currentQuestion.id}-jurisdiction`}
                      class="block text-sm font-bold text-white"
                    >
                      Issuing state or jurisdiction{' '}
                      <span class="font-normal text-white/55">(optional)</span>
                    </label>
                    <input
                      id={`${currentQuestion.id}-jurisdiction`}
                      type="text"
                      maxLength={80}
                      value={currentAnswer.jurisdiction}
                      onInput={(event) =>
                        dispatch({
                          type: 'answer/jurisdiction-changed',
                          questionId: currentQuestion.id,
                          jurisdiction: event.currentTarget.value,
                        })
                      }
                      class="mt-2 w-full rounded-xl border border-white/35 bg-white/[0.06] px-4 py-3 text-base text-white focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      for={`${currentQuestion.id}-expiry`}
                      class="block text-sm font-bold text-white"
                    >
                      Expiry month{' '}
                      <span class="font-normal text-white/55">(if known)</span>
                    </label>
                    <input
                      id={`${currentQuestion.id}-expiry`}
                      type="month"
                      value={currentAnswer.expiryDate}
                      onInput={(event) =>
                        dispatch({
                          type: 'answer/expiry-changed',
                          questionId: currentQuestion.id,
                          expiryDate: event.currentTarget.value,
                        })
                      }
                      aria-invalid={Boolean(expiryError)}
                      aria-describedby={
                        expiryError
                          ? `${currentQuestion.id}-expiry-error`
                          : undefined
                      }
                      class={`mt-2 w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-base text-white focus:border-accent focus:outline-none ${
                        expiryError ? 'border-red-300' : 'border-white/35'
                      }`}
                    />
                    {expiryError && (
                      <p
                        id={`${currentQuestion.id}-expiry-error`}
                        role="alert"
                        class="mt-2 text-sm text-red-200"
                      >
                        {expiryError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentAnswer?.response &&
            currentAnswer.status === 'unanswered' && (
              <p class="mt-4 text-xs leading-relaxed text-amber-100/80">
                This selection is not confirmed until you save it. If you are
                editing an earlier answer, its previous matching evidence has
                been withdrawn while you make changes.
              </p>
            )}

          <div class="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={currentIndex <= 0}
              onClick={() => goToQuestion(questions[currentIndex - 1]?.id ?? null)}
              class="min-h-11 rounded-full border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:border-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={skipCurrentQuestion}
              class="min-h-11 rounded-full border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:border-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Skip for now
            </button>
            <button
              type="submit"
              class="min-h-11 rounded-full bg-accent px-6 py-3 text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:ml-auto"
            >
              Save &amp; continue
            </button>
          </div>
        </form>
      ) : (
        <div class="mt-6">
          <h4
            id="follow-up-summary-heading"
            tabIndex={-1}
            class="rounded-2xl border border-accent/25 bg-accent/[0.06] p-4 text-sm font-bold leading-relaxed text-white/80"
          >
            Follow-up questions reviewed
          </h4>
          <p class="mt-3 text-xs leading-relaxed text-white/60">
            Questions reviewed. You can edit any answer below; matching will
            remove the previous confirmation while you edit and apply the new
            result when you save it.
          </p>
          <ul role="list" class="mt-4 space-y-3">
            {questions.map((question) => {
              const answer = answerFor(state, question.id);
              const match = matchResult.matches.find((candidate) =>
                question.coveredRequirementIds.includes(
                  candidate.requirement.id,
                ),
              );

              return (
                <li
                  key={question.id}
                  class="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/12 bg-black/15 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div class="min-w-0">
                    <p class="break-words text-sm font-bold text-white">
                      {question.requirement}
                    </p>
                    <p class="mt-1 text-xs leading-relaxed text-white/60">
                      {answer
                        ? ANSWER_STATUS_LABEL[answer.status]
                        : 'Not answered'}
                      {match ? ` · ${MATCH_STATUS_LABEL[match.status]}` : ''}
                    </p>
                    {answer?.details.trim() && (
                      <p class="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-white/75">
                        {answer.details}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => goToQuestion(question.id)}
                    aria-label={`Edit answer for ${question.requirement}`}
                    class="min-h-11 shrink-0 self-start rounded-full border border-white/30 px-4 py-2 text-xs font-bold text-white transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Edit answer
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p class="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/55">
        Only a saved Yes creates positive matching evidence. No records an
        explicit job-specific decision; Not sure, Sometimes / depends and Skip
        remain unresolved. Nothing here is added to your resume.
      </p>
    </section>
  );
}

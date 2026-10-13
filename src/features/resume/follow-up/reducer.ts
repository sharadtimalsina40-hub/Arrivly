import {
  FOLLOW_UP_SCHEMA_VERSION,
  type FollowUpAnswer,
  type FollowUpResponse,
  type FollowUpState,
} from './types';

export type FollowUpAction =
  | { readonly type: 'context/reset'; readonly contextKey: string | null }
  | {
      readonly type: 'answer/response-changed';
      readonly questionId: string;
      readonly response: FollowUpResponse;
    }
  | {
      readonly type: 'answer/details-changed';
      readonly questionId: string;
      readonly details: string;
    }
  | {
      readonly type: 'answer/jurisdiction-changed';
      readonly questionId: string;
      readonly jurisdiction: string;
    }
  | {
      readonly type: 'answer/expiry-changed';
      readonly questionId: string;
      readonly expiryDate: string;
    }
  | {
      readonly type: 'answer/committed';
      readonly questionId: string;
      readonly nextQuestionId: string | null;
    }
  | {
      readonly type: 'answer/skipped';
      readonly questionId: string;
      readonly nextQuestionId: string | null;
    }
  | {
      readonly type: 'navigation/question-changed';
      readonly questionId: string | null;
    };

export function createInitialFollowUpState(
  contextKey: string | null = null,
): FollowUpState {
  return {
    schemaVersion: FOLLOW_UP_SCHEMA_VERSION,
    contextKey,
    answers: [],
    activeQuestionId: null,
  };
}

function emptyAnswer(questionId: string): FollowUpAnswer {
  return {
    questionId,
    details: '',
    jurisdiction: '',
    expiryDate: '',
    status: 'unanswered',
  };
}

function updateAnswer(
  state: FollowUpState,
  questionId: string,
  update: (answer: FollowUpAnswer) => FollowUpAnswer,
): FollowUpState {
  const index = state.answers.findIndex(
    (answer) => answer.questionId === questionId,
  );
  const current = index >= 0 ? state.answers[index] : emptyAnswer(questionId);
  const nextAnswer = update(current);
  const nextAnswers =
    index >= 0
      ? state.answers.map((answer, answerIndex) =>
          answerIndex === index ? nextAnswer : answer,
        )
      : [...state.answers, nextAnswer];

  return { ...state, answers: nextAnswers };
}

export function followUpReducer(
  state: FollowUpState,
  action: FollowUpAction,
): FollowUpState {
  switch (action.type) {
    case 'context/reset':
      return action.contextKey === state.contextKey
        ? state
        : createInitialFollowUpState(action.contextKey);

    case 'answer/response-changed':
      return updateAnswer(state, action.questionId, (answer) => ({
        ...answer,
        response: action.response,
        details:
          action.response === 'yes' || action.response === 'depends'
            ? answer.details
            : '',
        jurisdiction:
          action.response === 'yes' ? answer.jurisdiction : '',
        expiryDate: action.response === 'yes' ? answer.expiryDate : '',
        // A changed selection is not evidence until Save & continue.
        status: 'unanswered',
      }));

    case 'answer/details-changed':
      return updateAnswer(state, action.questionId, (answer) => ({
        ...answer,
        details: action.details,
        status: answer.response ? 'unanswered' : answer.status,
      }));

    case 'answer/jurisdiction-changed':
      return updateAnswer(state, action.questionId, (answer) => ({
        ...answer,
        jurisdiction: action.jurisdiction,
        status: answer.response ? 'unanswered' : answer.status,
      }));

    case 'answer/expiry-changed':
      return updateAnswer(state, action.questionId, (answer) => ({
        ...answer,
        expiryDate: action.expiryDate,
        status: answer.response ? 'unanswered' : answer.status,
      }));

    case 'answer/committed':
      return {
        ...updateAnswer(state, action.questionId, (answer) => {
          if (!answer.response) {
            return answer;
          }

          return {
            ...answer,
            status:
              answer.response === 'yes'
                ? 'confirmed'
                : answer.response === 'no'
                  ? 'declined'
                  : 'uncertain',
          };
        }),
        activeQuestionId: action.nextQuestionId,
      };

    case 'answer/skipped':
      return {
        ...updateAnswer(state, action.questionId, (answer) => ({
          ...answer,
          response: undefined,
          details: '',
          jurisdiction: '',
          expiryDate: '',
          status: 'skipped',
        })),
        activeQuestionId: action.nextQuestionId,
      };

    case 'navigation/question-changed':
      return { ...state, activeQuestionId: action.questionId };
  }
}

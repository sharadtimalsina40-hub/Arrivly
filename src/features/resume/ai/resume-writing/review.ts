import type { GeneratedResumeProposal } from './types';

export type ResumeWritingDecision = 'accepted' | 'kept-original';
export type ResumeWritingViewMode = 'original' | 'tailored';

export interface ResumeWritingReviewState {
  readonly contextKey: string | null;
  readonly decisions: Readonly<Record<string, ResumeWritingDecision>>;
  readonly viewMode: ResumeWritingViewMode;
}

export type ResumeWritingReviewAction =
  | { readonly type: 'context/reset'; readonly contextKey: string | null }
  | {
      readonly type: 'suggestion/accepted';
      readonly suggestionId: string;
    }
  | {
      readonly type: 'suggestion/kept-original';
      readonly suggestionId: string;
    }
  | {
      readonly type: 'suggestion/undone';
      readonly suggestionId: string;
    }
  | {
      readonly type: 'all-safe/accepted';
      readonly suggestionIds: readonly string[];
    }
  | { readonly type: 'all/reset' }
  | {
      readonly type: 'view-mode/changed';
      readonly viewMode: ResumeWritingViewMode;
    };

function hasAcceptedDecision(
  decisions: Readonly<Record<string, ResumeWritingDecision>>,
): boolean {
  return Object.values(decisions).some((decision) => decision === 'accepted');
}

export function createInitialResumeWritingReviewState(
  contextKey: string | null = null,
): ResumeWritingReviewState {
  return { contextKey, decisions: {}, viewMode: 'original' };
}

export function resumeWritingReviewReducer(
  state: ResumeWritingReviewState,
  action: ResumeWritingReviewAction,
): ResumeWritingReviewState {
  switch (action.type) {
    case 'context/reset':
      return action.contextKey === state.contextKey &&
        Object.keys(state.decisions).length === 0 &&
        state.viewMode === 'original'
        ? state
        : {
            contextKey: action.contextKey,
            decisions: {},
            viewMode: 'original',
          };
    case 'suggestion/accepted':
      return {
        ...state,
        viewMode: 'tailored',
        decisions: {
          ...state.decisions,
          [action.suggestionId]: 'accepted',
        },
      };
    case 'suggestion/kept-original': {
      const decisions = {
        ...state.decisions,
        [action.suggestionId]: 'kept-original' as const,
      };
      return {
        ...state,
        decisions,
        viewMode: hasAcceptedDecision(decisions)
          ? state.viewMode
          : 'original',
      };
    }
    case 'suggestion/undone': {
      if (!(action.suggestionId in state.decisions)) {
        return state;
      }

      const decisions = { ...state.decisions };
      delete decisions[action.suggestionId];
      return {
        ...state,
        decisions,
        viewMode: hasAcceptedDecision(decisions)
          ? state.viewMode
          : 'original',
      };
    }
    case 'all-safe/accepted': {
      const decisions = { ...state.decisions };
      action.suggestionIds.forEach((id) => {
        decisions[id] = 'accepted';
      });
      return {
        ...state,
        decisions,
        viewMode:
          action.suggestionIds.length > 0 ? 'tailored' : state.viewMode,
      };
    }
    case 'all/reset':
      return {
        ...state,
        decisions: {},
        viewMode: 'original',
      };
    case 'view-mode/changed':
      return {
        ...state,
        viewMode:
          action.viewMode === 'tailored' &&
          !hasAcceptedDecision(state.decisions)
            ? 'original'
            : action.viewMode,
      };
  }
}

export function hasAcceptedResumeWritingSuggestions(
  state: ResumeWritingReviewState,
  proposal: GeneratedResumeProposal,
): boolean {
  return allResumeWritingSuggestionIds(proposal).some(
    (suggestionId) => state.decisions[suggestionId] === 'accepted',
  );
}

export const summarySuggestionId = 'resume-writing:summary';

export function experienceSuggestionId(
  experienceId: string,
  bulletIndex: number,
): string {
  return `resume-writing:experience:${experienceId}:bullet:${bulletIndex}`;
}

export function skillSuggestionId(skillIndex: number): string {
  return `resume-writing:skill:${skillIndex}`;
}

export function allResumeWritingSuggestionIds(
  proposal: GeneratedResumeProposal,
): readonly string[] {
  return [
    ...(proposal.summary ? [summarySuggestionId] : []),
    ...proposal.experience.flatMap((experience) =>
      experience.bullets.map((_, index) =>
        experienceSuggestionId(experience.experienceId, index),
      ),
    ),
    ...proposal.suggestedSkills.map((_, index) => skillSuggestionId(index)),
  ];
}

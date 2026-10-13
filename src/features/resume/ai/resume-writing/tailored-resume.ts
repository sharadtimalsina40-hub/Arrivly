import type {
  ResumeHighlightViewModel,
  ResumeSkillViewModel,
  ResumeViewModel,
} from '../../model/preview-model';
import {
  experienceSuggestionId,
  skillSuggestionId,
  summarySuggestionId,
  type ResumeWritingReviewState,
} from './review';
import type { GeneratedResumeProposal } from './types';

function normalizedSkillName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-AU');
}

function tailoredHighlight(
  experienceId: string,
  bulletIndex: number,
  text: string,
  original?: ResumeHighlightViewModel,
): ResumeHighlightViewModel {
  return {
    sourceFactId:
      original?.sourceFactId ??
      `tailored:${experienceSuggestionId(experienceId, bulletIndex)}`,
    text,
  };
}

function tailoredSkills(
  original: readonly ResumeSkillViewModel[],
  proposal: GeneratedResumeProposal,
  review: ResumeWritingReviewState,
): readonly ResumeSkillViewModel[] {
  const acceptedNames = new Set<string>();
  const accepted = proposal.suggestedSkills.flatMap((suggestion, index) => {
    if (review.decisions[skillSuggestionId(index)] !== 'accepted') {
      return [];
    }

    const normalizedName = normalizedSkillName(suggestion.text);
    if (acceptedNames.has(normalizedName)) {
      return [];
    }
    acceptedNames.add(normalizedName);
    const existing = original.find(
      (skill) => normalizedSkillName(skill.name) === normalizedName,
    );

    return [
      existing ?? {
        id: `tailored:${skillSuggestionId(index)}`,
        name: suggestion.text,
        category: 'other' as const,
        source: 'tailored' as const,
        evidenceFactIds: [...suggestion.sourceRefs],
      },
    ];
  });

  if (accepted.length === 0) {
    return original;
  }

  return [
    ...accepted,
    ...original.filter(
      (skill) => !acceptedNames.has(normalizedSkillName(skill.name)),
    ),
  ];
}

/**
 * Applies accepted, already-grounded wording to an immutable display model.
 * The canonical draft and its factual projection are never modified.
 */
export function buildTailoredResumeViewModel(
  original: ResumeViewModel,
  proposal: GeneratedResumeProposal,
  review: ResumeWritingReviewState,
): ResumeViewModel {
  const proposalByExperience = new Map(
    proposal.experience.map((experience) => [
      experience.experienceId,
      experience,
    ] as const),
  );
  const experience = original.sections.experience?.map((entry) => {
    const generated = proposalByExperience.get(entry.id);
    if (!generated) {
      return entry;
    }

    const originals = entry.highlights ?? [];
    const itemCount = Math.max(originals.length, generated.bullets.length);
    const highlights: ResumeHighlightViewModel[] = [];
    let changed = false;

    for (let index = 0; index < itemCount; index += 1) {
      const originalHighlight = originals[index];
      const generatedBullet = generated.bullets[index];
      const accepted =
        generatedBullet !== undefined &&
        review.decisions[experienceSuggestionId(entry.id, index)] ===
          'accepted';

      if (accepted) {
        highlights.push(
          tailoredHighlight(
            entry.id,
            index,
            generatedBullet.text,
            originalHighlight,
          ),
        );
        changed = true;
      } else if (originalHighlight) {
        highlights.push(originalHighlight);
      }
    }

    return changed ? { ...entry, highlights } : entry;
  });
  const originalSkills = original.sections.skills ?? [];
  const skills = tailoredSkills(originalSkills, proposal, review);
  const acceptedSummary =
    proposal.summary &&
    review.decisions[summarySuggestionId] === 'accepted'
      ? proposal.summary.text
      : original.summary;

  return {
    ...original,
    ...(acceptedSummary ? { summary: acceptedSummary } : {}),
    sections: {
      ...original.sections,
      ...(experience ? { experience } : {}),
      ...(skills.length > 0 ? { skills } : {}),
    },
  };
}

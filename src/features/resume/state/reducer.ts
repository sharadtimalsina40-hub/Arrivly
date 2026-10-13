import type {
  AdaptiveAnswer,
  EducationEntry,
  ExperienceEntry,
  IsoDateTime,
  JobAdvertisement,
  LicenceEntry,
  OccupationProfileId,
  ProfessionalLinks,
  ResumeDraftV1,
  ResumeLocation,
  SkillEntry,
  TemplateId,
  UserFact,
} from '../model/types';

interface ResumeDraftActionMetadata {
  at: IsoDateTime;
}

export type ExperienceEntryChanges = Partial<
  Omit<ExperienceEntry, 'id' | 'highlights'>
>;

export type EducationEntryChanges = Partial<
  Pick<
    EducationEntry,
    | 'qualification'
    | 'fieldOfStudy'
    | 'institution'
    | 'location'
    | 'completionDate'
    | 'status'
  >
>;

export type SkillEntryChanges = Partial<
  Pick<SkillEntry, 'name' | 'category'>
>;

export type LicenceEntryChanges = Partial<
  Pick<
    LicenceEntry,
    'name' | 'issuer' | 'jurisdiction' | 'expiryDate' | 'status'
  >
>;

export type ResumeDraftAction = ResumeDraftActionMetadata &
  (
    | {
        type: 'target-job/title-changed';
        jobTitle: string;
        classifiedProfileId: OccupationProfileId;
      }
    | {
        type: 'target-job/employer-changed';
        employer: string | undefined;
      }
    | {
        type: 'target-job/job-advertisement-changed';
        jobAdvertisement: JobAdvertisement;
      }
    | {
        type: 'target-job/occupation-profile-changed';
        profileId: OccupationProfileId;
        selectedBy: 'rule' | 'user';
        confirmed: boolean;
      }
    | {
        type: 'target-job/occupation-confirmed';
        confirmed: boolean;
      }
    | {
        type: 'adaptive-answer/upserted';
        answer: AdaptiveAnswer;
      }
    | {
        type: 'adaptive-answer/removed';
        answerId: string;
      }
    | {
        type: 'adaptive-answers/profile-cleared';
        profileId: OccupationProfileId;
      }
    | {
        type: 'experience/no-formal-experience-changed';
        hasNoFormalExperience: boolean;
      }
    | {
        type: 'experience/entry-added';
        entry: ExperienceEntry;
      }
    | {
        type: 'experience/entry-updated';
        entryId: string;
        changes: ExperienceEntryChanges;
      }
    | {
        type: 'experience/entry-removed';
        entryId: string;
      }
    | {
        type: 'experience/highlight-added';
        entryId: string;
        highlight: UserFact;
      }
    | {
        type: 'experience/highlight-updated';
        entryId: string;
        highlightId: string;
        text: string;
      }
    | {
        type: 'experience/highlight-removed';
        entryId: string;
        highlightId: string;
      }
    | {
        type: 'education/entry-added';
        entry: EducationEntry;
      }
    | {
        type: 'education/entry-updated';
        entryId: string;
        changes: EducationEntryChanges;
      }
    | {
        type: 'education/entry-removed';
        entryId: string;
      }
    | {
        type: 'skills/entry-added';
        entry: SkillEntry;
      }
    | {
        type: 'skills/entry-updated';
        entryId: string;
        changes: SkillEntryChanges;
      }
    | {
        type: 'skills/entry-removed';
        entryId: string;
      }
    | {
        type: 'licences/entry-added';
        entry: LicenceEntry;
      }
    | {
        type: 'licences/entry-updated';
        entryId: string;
        changes: LicenceEntryChanges;
      }
    | {
        type: 'licences/entry-removed';
        entryId: string;
      }
    | {
        type: 'personal-details/full-name-changed';
        fullName: string;
      }
    | {
        type: 'personal-details/phone-changed';
        phone: string;
      }
    | {
        type: 'personal-details/email-changed';
        email: string;
      }
    | {
        type: 'personal-details/location-changed';
        changes: Partial<ResumeLocation>;
      }
    | {
        type: 'personal-details/links-changed';
        changes: Partial<ProfessionalLinks>;
      }
    | {
        type: 'preferences/template-changed';
        templateId: TemplateId;
      }
  );

export function resumeDraftReducer(
  state: ResumeDraftV1,
  action: ResumeDraftAction,
): ResumeDraftV1 {
  switch (action.type) {
    case 'target-job/title-changed':
      return {
        ...state,
        updatedAt: action.at,
        targetJob: {
          ...state.targetJob,
          desiredTitle: action.jobTitle,
          occupation:
            state.targetJob.occupation.selectedBy === 'rule'
              ? {
                  profileId: action.classifiedProfileId,
                  selectedBy: 'rule',
                  confirmed: false,
                }
              : state.targetJob.occupation,
        },
      };

    case 'target-job/employer-changed':
      return {
        ...state,
        updatedAt: action.at,
        targetJob: {
          ...state.targetJob,
          employer: action.employer,
        },
      };

    case 'target-job/job-advertisement-changed':
      return {
        ...state,
        updatedAt: action.at,
        targetJob: {
          ...state.targetJob,
          jobAdvertisement: action.jobAdvertisement,
        },
      };

    case 'target-job/occupation-profile-changed':
      return {
        ...state,
        updatedAt: action.at,
        targetJob: {
          ...state.targetJob,
          occupation: {
            profileId: action.profileId,
            selectedBy: action.selectedBy,
            confirmed: action.confirmed,
          },
        },
      };

    case 'target-job/occupation-confirmed':
      return {
        ...state,
        updatedAt: action.at,
        targetJob: {
          ...state.targetJob,
          occupation: {
            ...state.targetJob.occupation,
            confirmed: action.confirmed,
          },
        },
      };

    case 'adaptive-answer/upserted': {
      const existingAnswer = state.adaptiveAnswers.find(
        (answer) =>
          answer.questionId === action.answer.questionId &&
          answer.occupationProfileId === action.answer.occupationProfileId,
      );
      const nextAnswer = existingAnswer
        ? { ...action.answer, id: existingAnswer.id }
        : action.answer;

      return {
        ...state,
        updatedAt: action.at,
        adaptiveAnswers: existingAnswer
          ? state.adaptiveAnswers.map((answer) =>
              answer.id === existingAnswer.id ? nextAnswer : answer,
            )
          : [...state.adaptiveAnswers, nextAnswer],
      };
    }

    case 'adaptive-answer/removed':
      return {
        ...state,
        updatedAt: action.at,
        adaptiveAnswers: state.adaptiveAnswers.filter(
          (answer) => answer.id !== action.answerId,
        ),
      };

    case 'adaptive-answers/profile-cleared':
      return {
        ...state,
        updatedAt: action.at,
        adaptiveAnswers: state.adaptiveAnswers.filter(
          (answer) => answer.occupationProfileId !== action.profileId,
        ),
      };

    case 'experience/no-formal-experience-changed':
      return {
        ...state,
        updatedAt: action.at,
        experienceInput: {
          ...state.experienceInput,
          hasNoFormalExperience:
            action.hasNoFormalExperience && state.experience.length === 0,
        },
      };

    case 'experience/entry-added':
      return {
        ...state,
        updatedAt: action.at,
        experienceInput: {
          ...state.experienceInput,
          hasNoFormalExperience: false,
        },
        experience: [...state.experience, action.entry],
      };

    case 'experience/entry-updated':
      return {
        ...state,
        updatedAt: action.at,
        experience: state.experience.map((entry) =>
          entry.id === action.entryId
            ? { ...entry, ...action.changes }
            : entry,
        ),
      };

    case 'experience/entry-removed':
      return {
        ...state,
        updatedAt: action.at,
        experience: state.experience.filter(
          (entry) => entry.id !== action.entryId,
        ),
      };

    case 'experience/highlight-added':
      return {
        ...state,
        updatedAt: action.at,
        experience: state.experience.map((entry) =>
          entry.id === action.entryId
            ? {
                ...entry,
                highlights: [...entry.highlights, action.highlight],
              }
            : entry,
        ),
      };

    case 'experience/highlight-updated':
      return {
        ...state,
        updatedAt: action.at,
        experience: state.experience.map((entry) =>
          entry.id === action.entryId
            ? {
                ...entry,
                highlights: entry.highlights.map((highlight) =>
                  highlight.id === action.highlightId
                    ? { ...highlight, text: action.text }
                    : highlight,
                ),
              }
            : entry,
        ),
      };

    case 'experience/highlight-removed':
      return {
        ...state,
        updatedAt: action.at,
        experience: state.experience.map((entry) =>
          entry.id === action.entryId
            ? {
                ...entry,
                highlights: entry.highlights.filter(
                  (highlight) => highlight.id !== action.highlightId,
                ),
              }
            : entry,
        ),
      };

    case 'education/entry-added':
      return {
        ...state,
        updatedAt: action.at,
        education: [...state.education, action.entry],
      };

    case 'education/entry-updated':
      return {
        ...state,
        updatedAt: action.at,
        education: state.education.map((entry) =>
          entry.id === action.entryId
            ? { ...entry, ...action.changes }
            : entry,
        ),
      };

    case 'education/entry-removed':
      return {
        ...state,
        updatedAt: action.at,
        education: state.education.filter(
          (entry) => entry.id !== action.entryId,
        ),
      };

    case 'skills/entry-added':
      return {
        ...state,
        updatedAt: action.at,
        skills: [...state.skills, action.entry],
      };

    case 'skills/entry-updated':
      return {
        ...state,
        updatedAt: action.at,
        skills: state.skills.map((entry) =>
          entry.id === action.entryId
            ? { ...entry, ...action.changes }
            : entry,
        ),
      };

    case 'skills/entry-removed':
      return {
        ...state,
        updatedAt: action.at,
        skills: state.skills.filter((entry) => entry.id !== action.entryId),
      };

    case 'licences/entry-added':
      return {
        ...state,
        updatedAt: action.at,
        licences: [...state.licences, action.entry],
      };

    case 'licences/entry-updated':
      return {
        ...state,
        updatedAt: action.at,
        licences: state.licences.map((entry) =>
          entry.id === action.entryId
            ? { ...entry, ...action.changes }
            : entry,
        ),
      };

    case 'licences/entry-removed':
      return {
        ...state,
        updatedAt: action.at,
        licences: state.licences.filter(
          (entry) => entry.id !== action.entryId,
        ),
      };

    case 'personal-details/full-name-changed':
      return {
        ...state,
        updatedAt: action.at,
        personalDetails: {
          ...state.personalDetails,
          fullName: action.fullName,
        },
      };

    case 'personal-details/phone-changed':
      return {
        ...state,
        updatedAt: action.at,
        personalDetails: {
          ...state.personalDetails,
          phone: action.phone,
        },
      };

    case 'personal-details/email-changed':
      return {
        ...state,
        updatedAt: action.at,
        personalDetails: {
          ...state.personalDetails,
          email: action.email,
        },
      };

    case 'personal-details/location-changed':
      return {
        ...state,
        updatedAt: action.at,
        personalDetails: {
          ...state.personalDetails,
          location: {
            ...state.personalDetails.location,
            ...action.changes,
          },
        },
      };

    case 'personal-details/links-changed':
      return {
        ...state,
        updatedAt: action.at,
        personalDetails: {
          ...state.personalDetails,
          links: {
            ...state.personalDetails.links,
            ...action.changes,
          },
        },
      };

    case 'preferences/template-changed':
      return {
        ...state,
        updatedAt: action.at,
        preferences: {
          ...state.preferences,
          templateId: action.templateId,
        },
      };

    default:
      return assertNever(action);
  }
}

function assertNever(action: never): never {
  throw new Error('Unhandled resume draft action');
}

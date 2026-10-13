import type {
  Content,
  Style,
  StyleDictionary,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import type {
  ResumeContactLinkViewModel,
  ResumeEducationViewModel,
  ResumeExperienceViewModel,
  ResumeLicenceViewModel,
  ResumeViewModel,
} from '../model/preview-model';

const PROFESSIONAL_LINK_LABELS: Readonly<
  Record<ResumeContactLinkViewModel['kind'], string>
> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
};

// 15 mm left/right, 14 mm top and 15 mm bottom, expressed in PDF points.
const A4_PAGE_MARGINS: [number, number, number, number] = [
  42.52, 39.69, 42.52, 42.52,
];

export interface ResumePdfTheme {
  readonly subject: string;
  readonly labelColor: string;
  readonly markerColor: string;
  readonly defaultStyle: Style;
  readonly styles: StyleDictionary;
  readonly spacing: {
    readonly headerBottom: number;
    readonly experienceEntryBottom: number;
    readonly educationEntryBottom: number;
    readonly licenceEntryBottom: number;
    readonly descriptionTop: number;
    readonly highlightsTop: number;
    readonly sectionListBottom: number;
  };
}

function compact<T>(values: readonly (T | undefined)[]): T[] {
  return values.filter((value): value is T => value !== undefined);
}

function labelledLine(
  label: string,
  value: string,
  theme: ResumePdfTheme,
): Content {
  return {
    text: [
      { text: `${label}: `, bold: true, color: theme.labelColor },
      { text: value },
    ],
    style: 'contactLine',
  };
}

function organisationLine(
  organisation: string | undefined,
  location: string | undefined,
): string | undefined {
  const parts = compact([organisation, location]);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function highlightsContent(
  highlights:
    | ResumeExperienceViewModel['highlights']
    | ResumeEducationViewModel['highlights'],
  theme: ResumePdfTheme,
): Content | undefined {
  if (!highlights?.length) {
    return undefined;
  }

  return {
    ul: highlights.map((highlight) => ({
      text: highlight.text,
      margin: [0, 0, 0, 2],
    })),
    style: 'body',
    markerColor: theme.markerColor,
    margin: [10, theme.spacing.highlightsTop, 0, 0],
  };
}

function experienceContent(
  entry: ResumeExperienceViewModel,
  theme: ResumePdfTheme,
): Content {
  const organisation = organisationLine(
    entry.organisation,
    entry.location,
  );
  const heading = compact<Content>([
    entry.roleTitle
      ? { text: entry.roleTitle, style: 'entryTitle' }
      : undefined,
    organisation
      ? { text: organisation, style: 'organisationLine' }
      : undefined,
    entry.dateRange
      ? { text: entry.dateRange, style: 'dateLine' }
      : undefined,
  ]);

  return {
    stack: compact<Content>([
      heading.length > 0 ? { stack: heading } : undefined,
      entry.description
        ? {
            text: entry.description,
            style: 'body',
            preserveLeadingSpaces: false,
            margin: [0, theme.spacing.descriptionTop, 0, 0],
          }
        : undefined,
      highlightsContent(entry.highlights, theme),
    ]),
    margin: [0, 0, 0, theme.spacing.experienceEntryBottom],
  };
}

function educationContent(
  entry: ResumeEducationViewModel,
  theme: ResumePdfTheme,
): Content {
  const institution = organisationLine(entry.institution, entry.location);
  const heading = compact<Content>([
    entry.qualification
      ? { text: entry.qualification, style: 'entryTitle' }
      : undefined,
    entry.fieldOfStudy
      ? { text: entry.fieldOfStudy, style: 'fieldLine' }
      : undefined,
    institution
      ? { text: institution, style: 'organisationLine' }
      : undefined,
    entry.dateRange
      ? { text: entry.dateRange, style: 'dateLine' }
      : undefined,
    { text: entry.statusLine, style: 'dateLine' },
  ]);

  return {
    stack: compact<Content>([
      { stack: heading },
      highlightsContent(entry.highlights, theme),
    ]),
    margin: [0, 0, 0, theme.spacing.educationEntryBottom],
  };
}

function licenceContent(
  entry: ResumeLicenceViewModel,
  theme: ResumePdfTheme,
): Content {
  return {
    stack: compact<Content>([
      entry.name
        ? { text: entry.name, style: 'entryTitle' }
        : undefined,
      entry.authority
        ? { text: entry.authority, style: 'organisationLine' }
        : undefined,
      { text: entry.statusLine, style: 'dateLine' },
    ]),
    margin: [0, 0, 0, theme.spacing.licenceEntryBottom],
  };
}

function sectionHeading(text: string): Content {
  return {
    text,
    style: 'sectionHeading',
    headlineLevel: 1,
  };
}

function buildHeader(
  resume: ResumeViewModel,
  theme: ResumePdfTheme,
): Content | undefined {
  const contact = resume.candidate.contact;
  const contactLines = compact<Content>([
    contact.phone
      ? labelledLine('Phone', contact.phone, theme)
      : undefined,
    contact.email
      ? labelledLine('Email', contact.email, theme)
      : undefined,
    contact.location
      ? labelledLine('Location', contact.location, theme)
      : undefined,
    ...(contact.links?.map((link) =>
      labelledLine(PROFESSIONAL_LINK_LABELS[link.kind], link.value, theme),
    ) ?? []),
  ]);
  const content = compact<Content>([
    resume.candidate.name
      ? { text: resume.candidate.name, style: 'candidateName' }
      : undefined,
    resume.targetJobTitle
      ? {
          text: [
            {
              text: 'Target role: ',
              bold: true,
              color: theme.labelColor,
            },
            { text: resume.targetJobTitle },
          ],
          style: 'targetRole',
        }
      : undefined,
    ...contactLines,
  ]);

  return content.length > 0
    ? {
        stack: content,
        margin: [0, 0, 0, theme.spacing.headerBottom],
      }
    : undefined;
}

/**
 * Shared factual PDF projection. Templates supply presentation only; this
 * function owns the complete and consistent ResumeViewModel field traversal.
 */
export function buildThemedResumePdfDocument(
  resume: ResumeViewModel,
  theme: ResumePdfTheme,
): TDocumentDefinitions {
  const content = compact<Content>([
    buildHeader(resume, theme),
    resume.summary
      ? [
          sectionHeading('PROFESSIONAL SUMMARY'),
          {
            text: resume.summary,
            style: 'body',
            margin: [0, 0, 0, theme.spacing.sectionListBottom],
          },
        ]
      : undefined,
    resume.sections.experience?.length
      ? [
          sectionHeading('EXPERIENCE'),
          ...resume.sections.experience.map((entry) =>
            experienceContent(entry, theme),
          ),
        ]
      : undefined,
    resume.sections.education?.length
      ? [
          sectionHeading('EDUCATION'),
          ...resume.sections.education.map((entry) =>
            educationContent(entry, theme),
          ),
        ]
      : undefined,
    resume.sections.skills?.length
      ? [
          sectionHeading('SKILLS'),
          {
            ul: resume.sections.skills.map((skill) => skill.name),
            style: 'body',
            markerColor: theme.markerColor,
            margin: [10, 0, 0, theme.spacing.sectionListBottom],
          },
        ]
      : undefined,
    resume.sections.licences?.length
      ? [
          sectionHeading('LICENCES AND CERTIFICATIONS'),
          ...resume.sections.licences.map((entry) =>
            licenceContent(entry, theme),
          ),
        ]
      : undefined,
  ]);

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: A4_PAGE_MARGINS,
    compress: true,
    tagged: true,
    language: 'en-AU',
    info: {
      title: 'Resume',
      subject: theme.subject,
      creator: 'Arrivly Resume Builder',
    },
    defaultStyle: theme.defaultStyle,
    styles: theme.styles,
    content,
    pageBreakBefore(currentNode, nodeQueries) {
      return (
        currentNode.headlineLevel === 1 &&
        nodeQueries.getFollowingNodesOnPage().length === 0
      );
    },
  };
}

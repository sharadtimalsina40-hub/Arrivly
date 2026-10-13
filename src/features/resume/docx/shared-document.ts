import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  PageOrientation,
  Paragraph,
  TextRun,
  UnderlineType,
  convertMillimetersToTwip,
  type IBordersOptions,
  type IRunStylePropertiesOptions,
  type IShadingAttributesProperties,
  type ISpacingProperties,
} from 'docx';
import type {
  ResumeContactLinkViewModel,
  ResumeEducationViewModel,
  ResumeExperienceViewModel,
  ResumeLicenceViewModel,
  ResumeViewModel,
} from '../model/preview-model';

const RESUME_BULLETS_REFERENCE = 'arrivly-resume-bullets';
const A4_WIDTH_TWIPS = 11_906;
const A4_HEIGHT_TWIPS = 16_838;

const PROFESSIONAL_LINK_LABELS: Readonly<
  Record<ResumeContactLinkViewModel['kind'], string>
> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
};

interface ResumeDocxParagraphTheme {
  readonly spacing: ISpacingProperties;
  readonly border?: IBordersOptions;
  readonly shading?: IShadingAttributesProperties;
}

export interface ResumeDocxTheme {
  readonly subject: string;
  readonly description: string;
  readonly runs: {
    readonly body: IRunStylePropertiesOptions;
    readonly label: IRunStylePropertiesOptions;
    readonly title: IRunStylePropertiesOptions;
    readonly targetRole: IRunStylePropertiesOptions;
    readonly contact: IRunStylePropertiesOptions;
    readonly sectionHeading: IRunStylePropertiesOptions;
    readonly entryHeading: IRunStylePropertiesOptions;
    readonly organisation: IRunStylePropertiesOptions;
    readonly supporting: IRunStylePropertiesOptions;
    readonly field: IRunStylePropertiesOptions;
    readonly hyperlink: IRunStylePropertiesOptions;
    readonly bullet: IRunStylePropertiesOptions;
    readonly bulletMarker: IRunStylePropertiesOptions;
  };
  readonly paragraphs: {
    readonly body: ResumeDocxParagraphTheme;
    readonly title: ResumeDocxParagraphTheme;
    readonly targetRole: ResumeDocxParagraphTheme;
    readonly contact: ResumeDocxParagraphTheme;
    readonly sectionHeading: ResumeDocxParagraphTheme;
    readonly entryHeading: ResumeDocxParagraphTheme;
    readonly supporting: ResumeDocxParagraphTheme;
    readonly field: ResumeDocxParagraphTheme;
    readonly description: ResumeDocxParagraphTheme;
    readonly bullet: ResumeDocxParagraphTheme;
    readonly licenceStatus: ResumeDocxParagraphTheme;
  };
  readonly bulletIndent: {
    readonly leftMillimetres: number;
    readonly hangingMillimetres: number;
  };
}

type ResumeRunKind = keyof ResumeDocxTheme['runs'];

function compact<T>(values: readonly (T | undefined)[]): T[] {
  return values.filter((value): value is T => value !== undefined);
}

function organisationLine(
  organisation: string | undefined,
  location: string | undefined,
): string | undefined {
  const parts = compact([organisation, location]);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function safeHyperlinkTarget(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }

    // The relationship must contain a valid URI, while the visible run below
    // continues to show the exact ResumeViewModel value.
    return url.href.replace(/%(?![\dA-Fa-f]{2})/g, '%25');
  } catch {
    return undefined;
  }
}

function themedRun(
  text: string,
  theme: ResumeDocxTheme,
  kind: ResumeRunKind,
  overrides: IRunStylePropertiesOptions = {},
): TextRun {
  return new TextRun({
    text,
    ...theme.runs[kind],
    ...overrides,
    language: { value: 'en-AU' },
  });
}

function paragraphTheme(
  value: ResumeDocxParagraphTheme,
): Pick<ResumeDocxParagraphTheme, 'spacing' | 'border' | 'shading'> {
  return {
    spacing: value.spacing,
    border: value.border,
    shading: value.shading,
  };
}

function labelledParagraph(
  label: string,
  value: string,
  theme: ResumeDocxTheme,
): Paragraph {
  return new Paragraph({
    children: [
      themedRun(`${label}: `, theme, 'label'),
      themedRun(value, theme, 'contact'),
    ],
    ...paragraphTheme(theme.paragraphs.contact),
    widowControl: true,
  });
}

function hyperlinkParagraph(
  label: string,
  value: string,
  theme: ResumeDocxTheme,
): Paragraph {
  const target = safeHyperlinkTarget(value);

  return new Paragraph({
    children: [
      themedRun(`${label}: `, theme, 'label'),
      ...(target
        ? [
            new ExternalHyperlink({
              link: target,
              children: [themedRun(value, theme, 'hyperlink')],
            }),
          ]
        : [themedRun(value, theme, 'contact')]),
    ],
    ...paragraphTheme(theme.paragraphs.contact),
    widowControl: true,
  });
}

function supportingParagraph(
  text: string,
  theme: ResumeDocxTheme,
  paragraph = theme.paragraphs.supporting,
): Paragraph {
  return new Paragraph({
    children: [themedRun(text, theme, 'supporting')],
    ...paragraphTheme(paragraph),
    widowControl: true,
  });
}

function organisationParagraph(
  text: string,
  theme: ResumeDocxTheme,
): Paragraph {
  return new Paragraph({
    children: [themedRun(text, theme, 'organisation')],
    ...paragraphTheme(theme.paragraphs.supporting),
    widowControl: true,
  });
}

function fieldParagraph(text: string, theme: ResumeDocxTheme): Paragraph {
  return new Paragraph({
    children: [themedRun(text, theme, 'field')],
    ...paragraphTheme(theme.paragraphs.field),
    widowControl: true,
  });
}

function bodyParagraphs(
  text: string,
  theme: ResumeDocxTheme,
): Paragraph[] {
  return text.split(/\r\n?|\n/).map(
    (line) =>
      new Paragraph({
        children: line ? [themedRun(line, theme, 'body')] : [],
        ...paragraphTheme(theme.paragraphs.description),
        widowControl: true,
      }),
  );
}

function bulletParagraph(text: string, theme: ResumeDocxTheme): Paragraph {
  return new Paragraph({
    children: [themedRun(text, theme, 'bullet')],
    numbering: {
      reference: RESUME_BULLETS_REFERENCE,
      level: 0,
    },
    ...paragraphTheme(theme.paragraphs.bullet),
    widowControl: true,
  });
}

function titleParagraph(text: string, theme: ResumeDocxTheme): Paragraph {
  return new Paragraph({
    children: [themedRun(text, theme, 'title')],
    heading: HeadingLevel.TITLE,
    ...paragraphTheme(theme.paragraphs.title),
    keepNext: true,
    widowControl: true,
  });
}

function sectionHeading(text: string, theme: ResumeDocxTheme): Paragraph {
  return new Paragraph({
    children: [themedRun(text, theme, 'sectionHeading')],
    heading: HeadingLevel.HEADING_1,
    ...paragraphTheme(theme.paragraphs.sectionHeading),
    keepNext: true,
    widowControl: true,
  });
}

function entryHeading(text: string, theme: ResumeDocxTheme): Paragraph {
  return new Paragraph({
    children: [themedRun(text, theme, 'entryHeading')],
    heading: HeadingLevel.HEADING_2,
    ...paragraphTheme(theme.paragraphs.entryHeading),
    keepNext: true,
    widowControl: true,
  });
}

function experienceParagraphs(
  entry: ResumeExperienceViewModel,
  theme: ResumeDocxTheme,
): Paragraph[] {
  const organisation = organisationLine(
    entry.organisation,
    entry.location,
  );

  return compact<Paragraph>([
    entry.roleTitle ? entryHeading(entry.roleTitle, theme) : undefined,
    organisation ? organisationParagraph(organisation, theme) : undefined,
    entry.dateRange
      ? supportingParagraph(entry.dateRange, theme)
      : undefined,
    ...(entry.description ? bodyParagraphs(entry.description, theme) : []),
    ...(entry.highlights?.map((highlight) =>
      bulletParagraph(highlight.text, theme),
    ) ?? []),
  ]);
}

function educationParagraphs(
  entry: ResumeEducationViewModel,
  theme: ResumeDocxTheme,
): Paragraph[] {
  const institution = organisationLine(entry.institution, entry.location);

  return compact<Paragraph>([
    entry.qualification
      ? entryHeading(entry.qualification, theme)
      : undefined,
    entry.fieldOfStudy
      ? fieldParagraph(entry.fieldOfStudy, theme)
      : undefined,
    institution ? organisationParagraph(institution, theme) : undefined,
    entry.dateRange
      ? supportingParagraph(entry.dateRange, theme)
      : undefined,
    supportingParagraph(entry.statusLine, theme),
    ...(entry.highlights?.map((highlight) =>
      bulletParagraph(highlight.text, theme),
    ) ?? []),
  ]);
}

function licenceParagraphs(
  entry: ResumeLicenceViewModel,
  theme: ResumeDocxTheme,
): Paragraph[] {
  return compact<Paragraph>([
    entry.name ? entryHeading(entry.name, theme) : undefined,
    entry.authority
      ? organisationParagraph(entry.authority, theme)
      : undefined,
    supportingParagraph(
      entry.statusLine,
      theme,
      theme.paragraphs.licenceStatus,
    ),
  ]);
}

/**
 * The single factual DOCX projection used by every Word template. Themes can
 * alter presentation tokens only; they cannot add, remove or rewrite fields.
 */
function buildDocumentParagraphs(
  resume: ResumeViewModel,
  theme: ResumeDocxTheme,
): Paragraph[] {
  const contact = resume.candidate.contact;
  const paragraphs = compact<Paragraph>([
    resume.candidate.name
      ? titleParagraph(resume.candidate.name, theme)
      : undefined,
    resume.targetJobTitle
      ? new Paragraph({
          children: [
            themedRun('Target role: ', theme, 'label'),
            themedRun(resume.targetJobTitle, theme, 'targetRole'),
          ],
          ...paragraphTheme(theme.paragraphs.targetRole),
          keepNext: true,
          widowControl: true,
        })
      : undefined,
    contact.phone
      ? labelledParagraph('Phone', contact.phone, theme)
      : undefined,
    contact.email
      ? labelledParagraph('Email', contact.email, theme)
      : undefined,
    contact.location
      ? labelledParagraph('Location', contact.location, theme)
      : undefined,
    ...(contact.links?.map((link) =>
      hyperlinkParagraph(
        PROFESSIONAL_LINK_LABELS[link.kind],
        link.value,
        theme,
      ),
    ) ?? []),
  ]);

  if (resume.summary) {
    paragraphs.push(
      sectionHeading('PROFESSIONAL SUMMARY', theme),
      ...bodyParagraphs(resume.summary, theme),
    );
  }

  if (resume.sections.experience?.length) {
    paragraphs.push(
      sectionHeading('EXPERIENCE', theme),
      ...resume.sections.experience.flatMap((entry) =>
        experienceParagraphs(entry, theme),
      ),
    );
  }

  if (resume.sections.education?.length) {
    paragraphs.push(
      sectionHeading('EDUCATION', theme),
      ...resume.sections.education.flatMap((entry) =>
        educationParagraphs(entry, theme),
      ),
    );
  }

  if (resume.sections.skills?.length) {
    paragraphs.push(
      sectionHeading('SKILLS', theme),
      ...resume.sections.skills.map((skill) =>
        bulletParagraph(skill.name, theme),
      ),
    );
  }

  if (resume.sections.licences?.length) {
    paragraphs.push(
      sectionHeading('LICENCES AND CERTIFICATIONS', theme),
      ...resume.sections.licences.flatMap((entry) =>
        licenceParagraphs(entry, theme),
      ),
    );
  }

  return paragraphs;
}

function withLanguage(
  style: IRunStylePropertiesOptions,
): IRunStylePropertiesOptions {
  return {
    ...style,
    language: { value: 'en-AU' },
  };
}

export function buildThemedResumeDocxDocument(
  resume: ResumeViewModel,
  theme: ResumeDocxTheme,
): Document {
  return new Document({
    title: 'Resume',
    subject: theme.subject,
    creator: 'Arrivly Resume Builder',
    description: theme.description,
    styles: {
      default: {
        document: {
          run: withLanguage(theme.runs.body),
          paragraph: {
            ...paragraphTheme(theme.paragraphs.body),
            widowControl: true,
          },
        },
        title: {
          run: withLanguage(theme.runs.title),
          paragraph: {
            ...paragraphTheme(theme.paragraphs.title),
            keepNext: true,
          },
        },
        heading1: {
          run: withLanguage(theme.runs.sectionHeading),
          paragraph: {
            ...paragraphTheme(theme.paragraphs.sectionHeading),
            keepNext: true,
            outlineLevel: 0,
          },
        },
        heading2: {
          run: withLanguage(theme.runs.entryHeading),
          paragraph: {
            ...paragraphTheme(theme.paragraphs.entryHeading),
            keepNext: true,
            outlineLevel: 1,
          },
        },
        hyperlink: {
          run: withLanguage({
            ...theme.runs.hyperlink,
            underline:
              theme.runs.hyperlink.underline ?? {
                type: UnderlineType.SINGLE,
              },
          }),
        },
      },
    },
    numbering: {
      config: [
        {
          reference: RESUME_BULLETS_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: {
                    left: convertMillimetersToTwip(
                      theme.bulletIndent.leftMillimetres,
                    ),
                    hanging: convertMillimetersToTwip(
                      theme.bulletIndent.hangingMillimetres,
                    ),
                  },
                },
                run: withLanguage(theme.runs.bulletMarker),
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: A4_WIDTH_TWIPS,
              height: A4_HEIGHT_TWIPS,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertMillimetersToTwip(14),
              right: convertMillimetersToTwip(15),
              bottom: convertMillimetersToTwip(15),
              left: convertMillimetersToTwip(15),
            },
          },
        },
        children: buildDocumentParagraphs(resume, theme),
      },
    ],
  });
}

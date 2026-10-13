import { BorderStyle, UnderlineType, type Document } from 'docx';
import type { ResumeViewModel } from '../model/preview-model';
import {
  buildThemedResumeDocxDocument,
  type ResumeDocxTheme,
} from './shared-document';

const FONT = 'Arial';
const INK = '202722';
const MUTED = '4E5852';
const RULE = 'D9DDDA';
const LINK = '315864';

const AUSTRALIAN_STANDARD_DOCX_THEME = {
  subject: 'Australian Standard resume',
  description: 'An editable Australian-style resume',
  runs: {
    body: { font: FONT, size: 20, color: INK },
    label: { font: FONT, size: 20, color: INK, bold: true },
    title: { font: FONT, size: 44, color: INK, bold: true },
    targetRole: { font: FONT, size: 20, color: INK },
    contact: { font: FONT, size: 20, color: INK },
    sectionHeading: {
      font: FONT,
      size: 22,
      color: INK,
      bold: true,
      allCaps: true,
    },
    entryHeading: { font: FONT, size: 21, color: INK, bold: true },
    organisation: { font: FONT, size: 20, color: MUTED, bold: true },
    supporting: { font: FONT, size: 20, color: MUTED },
    field: { font: FONT, size: 20, color: INK },
    hyperlink: {
      font: FONT,
      size: 20,
      color: LINK,
      underline: { type: UnderlineType.SINGLE, color: LINK },
    },
    bullet: { font: FONT, size: 20, color: INK },
    bulletMarker: { font: FONT, size: 20, color: INK },
  },
  paragraphs: {
    body: { spacing: { line: 276, after: 80 } },
    title: { spacing: { after: 80 } },
    targetRole: { spacing: { after: 120 } },
    contact: { spacing: { after: 40 } },
    sectionHeading: {
      spacing: { before: 240, after: 100 },
      border: {
        top: {
          style: BorderStyle.SINGLE,
          color: RULE,
          size: 4,
          space: 8,
        },
      },
    },
    entryHeading: { spacing: { before: 160, after: 40 } },
    supporting: { spacing: { after: 40 } },
    field: { spacing: { after: 40 } },
    description: { spacing: { before: 40, after: 40 } },
    bullet: { spacing: { after: 40 } },
    licenceStatus: { spacing: { after: 100 } },
  },
  bulletIndent: {
    leftMillimetres: 6,
    hangingMillimetres: 3,
  },
} as const satisfies ResumeDocxTheme;

/** Australian Standard presentation over the shared factual Word document. */
export function buildAustralianStandardDocxDocument(
  resume: ResumeViewModel,
): Document {
  return buildThemedResumeDocxDocument(
    resume,
    AUSTRALIAN_STANDARD_DOCX_THEME,
  );
}

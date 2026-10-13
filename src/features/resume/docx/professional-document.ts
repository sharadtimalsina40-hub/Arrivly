import { BorderStyle, UnderlineType, type Document } from 'docx';
import type { ResumeViewModel } from '../model/preview-model';
import {
  buildThemedResumeDocxDocument,
  type ResumeDocxTheme,
} from './shared-document';

const FONT = 'Arial';
const INK = '202722';
const MUTED = '4E5852';
const ACCENT = '315864';
const ACCENT_DARK = '234752';

const PROFESSIONAL_DOCX_THEME = {
  subject: 'Professional resume',
  description: 'An editable professional resume',
  runs: {
    body: { font: FONT, size: 20, color: INK },
    label: { font: FONT, size: 20, color: INK, bold: true },
    title: { font: FONT, size: 48, color: INK, bold: true },
    targetRole: { font: FONT, size: 24, color: ACCENT, bold: true },
    contact: { font: FONT, size: 19, color: MUTED },
    sectionHeading: {
      font: FONT,
      size: 23,
      color: ACCENT_DARK,
      bold: true,
      allCaps: true,
    },
    entryHeading: { font: FONT, size: 22, color: INK, bold: true },
    organisation: {
      font: FONT,
      size: 19,
      color: ACCENT,
      bold: true,
    },
    supporting: { font: FONT, size: 19, color: MUTED },
    field: { font: FONT, size: 20, color: INK },
    hyperlink: {
      font: FONT,
      size: 19,
      color: ACCENT,
      underline: { type: UnderlineType.SINGLE, color: ACCENT },
    },
    bullet: { font: FONT, size: 20, color: INK },
    bulletMarker: { font: FONT, size: 20, color: ACCENT },
  },
  paragraphs: {
    body: { spacing: { line: 288, after: 90 } },
    title: { spacing: { after: 100 } },
    targetRole: { spacing: { after: 160 } },
    contact: { spacing: { after: 40 } },
    sectionHeading: {
      spacing: { before: 280, after: 120 },
      border: {
        top: {
          style: BorderStyle.SINGLE,
          color: ACCENT,
          size: 8,
          space: 8,
        },
      },
    },
    entryHeading: { spacing: { before: 180, after: 40 } },
    supporting: { spacing: { after: 40 } },
    field: { spacing: { after: 40 } },
    description: { spacing: { before: 60, after: 40 } },
    bullet: { spacing: { after: 45 } },
    licenceStatus: { spacing: { after: 120 } },
  },
  bulletIndent: {
    leftMillimetres: 6,
    hangingMillimetres: 3,
  },
} as const satisfies ResumeDocxTheme;

/** Professional presentation over the shared factual Word document. */
export function buildProfessionalDocxDocument(
  resume: ResumeViewModel,
): Document {
  return buildThemedResumeDocxDocument(resume, PROFESSIONAL_DOCX_THEME);
}

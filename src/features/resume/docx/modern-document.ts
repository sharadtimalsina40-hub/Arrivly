import { BorderStyle, UnderlineType, type Document } from 'docx';
import type { ResumeViewModel } from '../model/preview-model';
import {
  buildThemedResumeDocxDocument,
  type ResumeDocxTheme,
} from './shared-document';

const FONT = 'Arial';
const INK = '17231D';
const BODY = '202722';
const SUPPORTING = '405047';
const MUTED = '4E5852';
const HEADING = '26352D';
const BULLET = '667A2C';
const LINK = '315864';
const ACCENT = 'C8F064';
const PALE_RULE = 'D9E2C1';

const MODERN_DOCX_THEME = {
  subject: 'Modern resume',
  description: 'An editable contemporary Australian-style resume',
  runs: {
    body: { font: FONT, size: 20, color: BODY },
    label: { font: FONT, size: 20, color: INK, bold: true },
    title: { font: FONT, size: 48, color: INK, bold: true },
    targetRole: { font: FONT, size: 23, color: SUPPORTING },
    contact: { font: FONT, size: 19, color: MUTED },
    sectionHeading: {
      font: FONT,
      size: 22,
      color: HEADING,
      bold: true,
      allCaps: true,
    },
    entryHeading: { font: FONT, size: 22, color: INK, bold: true },
    organisation: {
      font: FONT,
      size: 19,
      color: SUPPORTING,
      bold: true,
    },
    supporting: { font: FONT, size: 19, color: MUTED },
    field: { font: FONT, size: 20, color: HEADING },
    hyperlink: {
      font: FONT,
      size: 19,
      color: LINK,
      underline: { type: UnderlineType.SINGLE, color: LINK },
    },
    bullet: { font: FONT, size: 20, color: BODY },
    bulletMarker: { font: FONT, size: 20, color: BULLET },
  },
  paragraphs: {
    body: { spacing: { line: 276, after: 80 } },
    title: {
      spacing: { after: 100 },
      border: {
        top: {
          style: BorderStyle.SINGLE,
          color: ACCENT,
          size: 16,
          space: 8,
        },
      },
    },
    targetRole: { spacing: { after: 140 } },
    contact: { spacing: { after: 40 } },
    sectionHeading: {
      spacing: { before: 220, after: 100 },
      border: {
        left: {
          style: BorderStyle.SINGLE,
          color: ACCENT,
          size: 16,
          space: 8,
        },
        bottom: {
          style: BorderStyle.SINGLE,
          color: PALE_RULE,
          size: 4,
          space: 6,
        },
      },
    },
    entryHeading: { spacing: { before: 180, after: 40 } },
    supporting: { spacing: { after: 40 } },
    field: { spacing: { after: 40 } },
    description: { spacing: { before: 60, after: 40 } },
    bullet: { spacing: { after: 50 } },
    licenceStatus: { spacing: { after: 120 } },
  },
  bulletIndent: {
    leftMillimetres: 6,
    hangingMillimetres: 3,
  },
} as const satisfies ResumeDocxTheme;

/** Modern presentation over the shared factual Word document. */
export function buildModernDocxDocument(
  resume: ResumeViewModel,
): Document {
  return buildThemedResumeDocxDocument(resume, MODERN_DOCX_THEME);
}

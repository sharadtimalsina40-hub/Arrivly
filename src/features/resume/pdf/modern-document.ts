import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ResumeViewModel } from '../model/preview-model';
import {
  buildThemedResumePdfDocument,
  type ResumePdfTheme,
} from './shared-document';

const MODERN_PDF_THEME = {
  subject: 'Modern resume',
  labelColor: '#17231d',
  markerColor: '#667a2c',
  defaultStyle: {
    font: 'Roboto',
    fontSize: 10,
    lineHeight: 1.3,
    color: '#202722',
  },
  styles: {
    candidateName: {
      fontSize: 24,
      bold: true,
      lineHeight: 1.05,
      characterSpacing: -0.15,
      color: '#17231d',
      margin: [0, 0, 0, 7],
    },
    targetRole: {
      fontSize: 11.5,
      color: '#405047',
      margin: [0, 0, 0, 10],
    },
    contactLine: {
      fontSize: 9.5,
      color: '#4e5852',
      margin: [0, 0, 0, 2],
    },
    sectionHeading: {
      fontSize: 11,
      bold: true,
      characterSpacing: 1.2,
      color: '#26352d',
      background: '#eef6d5',
      decoration: 'underline',
      decorationColor: '#c8f064',
      decorationThickness: 2,
      margin: [0, 11, 0, 9],
    },
    entryTitle: {
      fontSize: 11,
      bold: true,
      lineHeight: 1.2,
      color: '#17231d',
      margin: [0, 0, 0, 2],
    },
    organisationLine: {
      fontSize: 9.5,
      bold: true,
      color: '#405047',
      margin: [0, 0, 0, 2],
    },
    dateLine: {
      fontSize: 9.5,
      color: '#4e5852',
      margin: [0, 0, 0, 2],
    },
    fieldLine: {
      fontSize: 10,
      color: '#26352d',
      margin: [0, 0, 0, 2],
    },
    body: {
      fontSize: 10,
      lineHeight: 1.3,
    },
  },
  spacing: {
    headerBottom: 15,
    experienceEntryBottom: 13,
    educationEntryBottom: 12,
    licenceEntryBottom: 11,
    descriptionTop: 5,
    highlightsTop: 5,
    sectionListBottom: 9,
  },
} as const satisfies ResumePdfTheme;

/**
 * Modern adds restrained green/lime accents and contemporary spacing without
 * changing, deriving or reordering any candidate content.
 */
export function buildModernPdfDocument(
  resume: ResumeViewModel,
): TDocumentDefinitions {
  return buildThemedResumePdfDocument(resume, MODERN_PDF_THEME);
}

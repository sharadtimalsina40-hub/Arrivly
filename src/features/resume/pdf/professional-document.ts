import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ResumeViewModel } from '../model/preview-model';
import {
  buildThemedResumePdfDocument,
  type ResumePdfTheme,
} from './shared-document';

const PROFESSIONAL_PDF_THEME = {
  subject: 'Professional resume',
  labelColor: '#234752',
  markerColor: '#315864',
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
      lineHeight: 1.08,
      color: '#202722',
      margin: [0, 0, 0, 6],
    },
    targetRole: {
      fontSize: 12,
      bold: true,
      color: '#315864',
      margin: [0, 0, 0, 10],
    },
    contactLine: {
      fontSize: 9.5,
      color: '#4e5852',
      margin: [0, 0, 0, 2],
    },
    sectionHeading: {
      fontSize: 11.5,
      bold: true,
      characterSpacing: 1,
      color: '#234752',
      decoration: 'underline',
      decorationColor: '#315864',
      decorationThickness: 1,
      margin: [0, 12, 0, 9],
    },
    entryTitle: {
      fontSize: 11,
      bold: true,
      lineHeight: 1.2,
      color: '#202722',
      margin: [0, 0, 0, 2],
    },
    organisationLine: {
      fontSize: 9.5,
      bold: true,
      color: '#315864',
      margin: [0, 0, 0, 2],
    },
    dateLine: {
      fontSize: 9.5,
      color: '#4e5852',
      margin: [0, 0, 0, 2],
    },
    fieldLine: {
      fontSize: 10,
      color: '#202722',
      margin: [0, 0, 0, 2],
    },
    body: {
      fontSize: 10,
      lineHeight: 1.3,
    },
  },
  spacing: {
    headerBottom: 16,
    experienceEntryBottom: 14,
    educationEntryBottom: 13,
    licenceEntryBottom: 12,
    descriptionTop: 5,
    highlightsTop: 5,
    sectionListBottom: 10,
  },
} as const satisfies ResumePdfTheme;

/**
 * Professional uses stronger hierarchy, teal supporting text and more open
 * spacing while rendering the exact shared ResumeViewModel projection.
 */
export function buildProfessionalPdfDocument(
  resume: ResumeViewModel,
): TDocumentDefinitions {
  return buildThemedResumePdfDocument(resume, PROFESSIONAL_PDF_THEME);
}

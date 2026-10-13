import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ResumeViewModel } from '../model/preview-model';
import {
  buildThemedResumePdfDocument,
  type ResumePdfTheme,
} from './shared-document';

const AUSTRALIAN_STANDARD_PDF_THEME = {
  subject: 'Australian Standard resume',
  labelColor: '#202722',
  markerColor: '#202722',
  defaultStyle: {
    font: 'Roboto',
    fontSize: 10,
    lineHeight: 1.28,
    color: '#202722',
  },
  styles: {
    candidateName: {
      fontSize: 22,
      bold: true,
      lineHeight: 1.1,
      margin: [0, 0, 0, 5],
    },
    targetRole: {
      fontSize: 11,
      color: '#3f4943',
      margin: [0, 0, 0, 8],
    },
    contactLine: {
      fontSize: 9.5,
      color: '#4e5852',
      margin: [0, 0, 0, 2],
    },
    sectionHeading: {
      fontSize: 11,
      bold: true,
      characterSpacing: 0.7,
      color: '#202722',
      margin: [0, 9, 0, 8],
    },
    entryTitle: {
      fontSize: 10.5,
      bold: true,
      lineHeight: 1.2,
      margin: [0, 0, 0, 2],
    },
    organisationLine: {
      fontSize: 9.5,
      color: '#4e5852',
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
      lineHeight: 1.28,
    },
  },
  spacing: {
    headerBottom: 14,
    experienceEntryBottom: 12,
    educationEntryBottom: 11,
    licenceEntryBottom: 10,
    descriptionTop: 5,
    highlightsTop: 5,
    sectionListBottom: 8,
  },
} as const satisfies ResumePdfTheme;

/**
 * Australian Standard is a presentation adapter over the shared factual PDF
 * projection. It changes no ResumeViewModel content or ordering.
 */
export function buildAustralianStandardPdfDocument(
  resume: ResumeViewModel,
): TDocumentDefinitions {
  return buildThemedResumePdfDocument(
    resume,
    AUSTRALIAN_STANDARD_PDF_THEME,
  );
}

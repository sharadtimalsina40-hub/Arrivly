import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ResumeViewModel } from '../model/preview-model';
import type { TemplateId } from '../model/types';
import { buildAustralianStandardPdfDocument } from './australian-standard-document';
import { buildModernPdfDocument } from './modern-document';
import { buildProfessionalPdfDocument } from './professional-document';

export type ResumePdfDocumentBuilder = (
  resume: ResumeViewModel,
) => TDocumentDefinitions;

export interface ResumePdfTemplateRegistration {
  readonly label: string;
  readonly buildDocument: ResumePdfDocumentBuilder;
}

export const DEFAULT_RESUME_PDF_TEMPLATE_ID: TemplateId =
  'australian-standard';

/** Compile-time exhaustive registry for every canonical resume TemplateId. */
export const resumePdfTemplates = {
  'australian-standard': {
    label: 'Australian Standard',
    buildDocument: buildAustralianStandardPdfDocument,
  },
  professional: {
    label: 'Professional',
    buildDocument: buildProfessionalPdfDocument,
  },
  modern: {
    label: 'Modern',
    buildDocument: buildModernPdfDocument,
  },
} as const satisfies Readonly<
  Record<TemplateId, ResumePdfTemplateRegistration>
>;

export interface ResolvedResumePdfTemplate {
  readonly id: TemplateId;
  readonly label: string;
  readonly buildDocument: ResumePdfDocumentBuilder;
}

export function resolveResumePdfTemplate(
  templateId: TemplateId,
): ResolvedResumePdfTemplate {
  const selectedTemplate = resumePdfTemplates[templateId] as
    | ResumePdfTemplateRegistration
    | undefined;

  if (selectedTemplate) {
    return {
      id: templateId,
      ...selectedTemplate,
    };
  }

  const fallback = resumePdfTemplates[DEFAULT_RESUME_PDF_TEMPLATE_ID];

  return {
    id: DEFAULT_RESUME_PDF_TEMPLATE_ID,
    ...fallback,
  };
}

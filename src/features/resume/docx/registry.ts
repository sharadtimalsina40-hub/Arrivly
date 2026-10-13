import type { Document } from 'docx';
import type { ResumeViewModel } from '../model/preview-model';
import type { TemplateId } from '../model/types';
import { buildAustralianStandardDocxDocument } from './australian-standard-document';
import { buildModernDocxDocument } from './modern-document';
import { buildProfessionalDocxDocument } from './professional-document';

export type ResumeDocxDocumentBuilder = (
  resume: ResumeViewModel,
) => Document;

export interface ResumeDocxTemplateRegistration {
  readonly label: string;
  readonly buildDocument: ResumeDocxDocumentBuilder;
}

export const DEFAULT_RESUME_DOCX_TEMPLATE_ID: TemplateId =
  'australian-standard';

/** Compile-time exhaustive registry for every canonical resume TemplateId. */
export const resumeDocxTemplates = {
  'australian-standard': {
    label: 'Australian Standard',
    buildDocument: buildAustralianStandardDocxDocument,
  },
  professional: {
    label: 'Professional',
    buildDocument: buildProfessionalDocxDocument,
  },
  modern: {
    label: 'Modern',
    buildDocument: buildModernDocxDocument,
  },
} as const satisfies Readonly<
  Record<TemplateId, ResumeDocxTemplateRegistration>
>;

export interface ResolvedResumeDocxTemplate {
  readonly id: TemplateId;
  readonly label: string;
  readonly buildDocument: ResumeDocxDocumentBuilder;
}

export function resolveResumeDocxTemplate(
  templateId: TemplateId,
): ResolvedResumeDocxTemplate {
  const selectedTemplate = resumeDocxTemplates[templateId] as
    | ResumeDocxTemplateRegistration
    | undefined;

  if (selectedTemplate) {
    return {
      id: templateId,
      ...selectedTemplate,
    };
  }

  const fallback =
    resumeDocxTemplates[DEFAULT_RESUME_DOCX_TEMPLATE_ID];

  return {
    id: DEFAULT_RESUME_DOCX_TEMPLATE_ID,
    ...fallback,
  };
}

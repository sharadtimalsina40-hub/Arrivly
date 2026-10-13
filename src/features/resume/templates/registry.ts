import type { FunctionComponent } from 'preact';
import type { ResumeViewModel } from '../model/preview-model';
import type { TemplateId } from '../model/types';
import AustralianStandard from './AustralianStandard';
import Modern from './Modern';
import Professional from './Professional';

export interface ResumeTemplateProps {
  readonly resume: ResumeViewModel;
}

export type ResumeTemplateComponent = FunctionComponent<ResumeTemplateProps>;

export interface ResumeTemplateOption {
  readonly id: TemplateId;
  readonly label: string;
  readonly description: string;
}

export interface ResumeTemplateRegistration {
  readonly label: string;
  readonly description: string;
  readonly renderer: ResumeTemplateComponent;
}

export const DEFAULT_RESUME_TEMPLATE_ID: TemplateId =
  'australian-standard';

export const resumeTemplates = {
  'australian-standard': {
    label: 'Australian Standard',
    description: 'Simple and ATS-first.',
    renderer: AustralianStandard,
  },
  professional: {
    label: 'Professional',
    description: 'Polished and traditional.',
    renderer: Professional,
  },
  modern: {
    label: 'Modern',
    description: 'Contemporary and clean.',
    renderer: Modern,
  },
} as const satisfies Readonly<
  Record<TemplateId, ResumeTemplateRegistration>
>;

const RESUME_TEMPLATE_ORDER = [
  'australian-standard',
  'professional',
  'modern',
] as const satisfies readonly TemplateId[];

export const resumeTemplateOptions: readonly ResumeTemplateOption[] =
  RESUME_TEMPLATE_ORDER.map((id) => {
    const registration = resumeTemplates[id];

    return {
      id,
      label: registration.label,
      description: registration.description,
    };
  });

export interface ResolvedResumeTemplate {
  readonly id: TemplateId;
  readonly renderer: ResumeTemplateComponent;
}

export function resolveResumeTemplate(
  templateId: TemplateId,
): ResolvedResumeTemplate {
  const selectedTemplate = resumeTemplates[templateId] as
    | ResumeTemplateRegistration
    | undefined;

  if (selectedTemplate) {
    return {
      id: templateId,
      renderer: selectedTemplate.renderer,
    };
  }

  const fallbackTemplate = resumeTemplates[DEFAULT_RESUME_TEMPLATE_ID];

  if (!fallbackTemplate) {
    throw new Error('The default resume template is not registered');
  }

  return {
    id: DEFAULT_RESUME_TEMPLATE_ID,
    renderer: fallbackTemplate.renderer,
  };
}

export function getResumeTemplate(
  templateId: TemplateId,
): ResumeTemplateComponent {
  return resolveResumeTemplate(templateId).renderer;
}

import { Packer } from 'docx';
import { getResumeExportValidationError } from '../export/validation';
import type { ResumeViewModel } from '../model/preview-model';
import type { TemplateId } from '../model/types';
import { resolveResumeDocxTemplate } from './registry';

const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class ResumeDocxValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeDocxValidationError';
  }
}

/** Generates the selected editable Word design entirely in the browser. */
export async function generateResumeDocx(
  resume: ResumeViewModel,
  templateId: TemplateId,
): Promise<Blob> {
  const validationError = getResumeExportValidationError(resume);

  if (validationError) {
    throw new ResumeDocxValidationError(validationError);
  }

  const document =
    resolveResumeDocxTemplate(templateId).buildDocument(resume);
  const blob = await Packer.toBlob(document);

  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('The Word document engine returned an empty file');
  }

  const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer());

  if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
    throw new Error('The Word document engine returned an invalid file');
  }

  return blob.type === DOCX_MIME_TYPE
    ? blob
    : new Blob([blob], { type: DOCX_MIME_TYPE });
}

/** Kept for callers that explicitly need the original Australian design. */
export function generateAustralianStandardResumeDocx(
  resume: ResumeViewModel,
): Promise<Blob> {
  return generateResumeDocx(resume, 'australian-standard');
}

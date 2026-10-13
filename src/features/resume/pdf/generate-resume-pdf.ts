import type { TDocumentDefinitions, TVirtualFileSystem } from 'pdfmake/interfaces';
import type { ResumeViewModel } from '../model/preview-model';
import type { TemplateId } from '../model/types';
import { getResumeExportValidationError } from '../export/validation';
import { findUnsupportedPdfCharacter } from './font-coverage';
import { resolveResumePdfTemplate } from './registry';

interface PdfMakeBrowserApi {
  addVirtualFileSystem(vfs: TVirtualFileSystem): void;
  createPdf(definition: TDocumentDefinitions): {
    getBlob(): Promise<Blob>;
  };
}

let pdfMakePromise: Promise<PdfMakeBrowserApi> | undefined;

function isPdfMakeBrowserApi(value: unknown): value is PdfMakeBrowserApi {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<PdfMakeBrowserApi>;
  return (
    typeof candidate.addVirtualFileSystem === 'function' &&
    typeof candidate.createPdf === 'function'
  );
}

async function loadPdfMake(): Promise<PdfMakeBrowserApi> {
  if (pdfMakePromise) {
    return pdfMakePromise;
  }

  pdfMakePromise = Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
    .then(([pdfMakeModule, vfsModule]) => {
      const moduleWithDefault = pdfMakeModule as unknown as {
        readonly default?: unknown;
      };
      const pdfMakeCandidate = moduleWithDefault.default ?? pdfMakeModule;

      if (!isPdfMakeBrowserApi(pdfMakeCandidate)) {
        throw new Error('The PDF engine could not be loaded');
      }

      pdfMakeCandidate.addVirtualFileSystem(vfsModule.default);
      return pdfMakeCandidate;
    })
    .catch((error: unknown) => {
      pdfMakePromise = undefined;
      throw error;
    });

  return pdfMakePromise;
}

export class ResumePdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumePdfValidationError';
  }
}

/**
 * Generates the selected text-based PDF entirely in the browser. Every
 * template receives only the same ResumeViewModel factual projection.
 */
export async function generateResumePdf(
  resume: ResumeViewModel,
  templateId: TemplateId,
): Promise<Blob> {
  const validationError = getResumeExportValidationError(resume);

  if (validationError) {
    throw new ResumePdfValidationError(validationError);
  }

  const { buildDocument } = resolveResumePdfTemplate(templateId);
  const definition = buildDocument(resume);
  const unsupportedCharacter = findUnsupportedPdfCharacter(
    definition.content,
  );

  if (unsupportedCharacter) {
    throw new ResumePdfValidationError(
      'The direct PDF font cannot safely render one or more characters in this resume. Use browser print instead.',
    );
  }

  const pdfMake = await loadPdfMake();
  const blob = await pdfMake.createPdf(definition).getBlob();

  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('The PDF engine returned an empty file');
  }

  return blob;
}

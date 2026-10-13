import type { ResumeViewModel } from '../model/preview-model';
import {
  buildResumeExportFilename,
  downloadResumeBlob,
} from '../export/download';

export function buildResumePdfFilename(
  resume: ResumeViewModel,
): string {
  return buildResumeExportFilename(resume, 'pdf');
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  downloadResumeBlob(blob, filename);
}

import type { ResumeViewModel } from '../model/preview-model';

export type ResumeExportExtension = 'pdf' | 'docx';

const MAX_FILENAME_NAME_LENGTH = 80;
const OBJECT_URL_REVOKE_DELAY_MS = 30_000;

export function buildResumeExportFilename(
  resume: ResumeViewModel,
  extension: ResumeExportExtension,
): string {
  const normalisedName = resume.candidate.name
    ?.normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  const safeName = normalisedName
    ? [...normalisedName]
        .slice(0, MAX_FILENAME_NAME_LENGTH)
        .join('')
        .replace(/-+$/g, '')
    : undefined;

  return safeName
    ? `${safeName}-Resume.${extension}`
    : `Arrivly-Resume.${extension}`;
}

export function downloadResumeBlob(blob: Blob, filename: string): void {
  if (blob.size === 0) {
    throw new Error('Cannot download an empty resume file');
  }

  if (!document.body) {
    throw new Error('The browser download surface is unavailable');
  }

  const objectUrl = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | undefined;

  try {
    anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    // Safari can cancel a download when its object URL is revoked immediately.
    window.setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      OBJECT_URL_REVOKE_DELAY_MS,
    );
  }
}

import type { ResumeViewModel } from '../model/preview-model';

/** Defensive validation for any renderer that receives a ResumeViewModel. */
export function getResumeExportValidationError(
  resume: ResumeViewModel,
): string | undefined {
  if (!resume.candidate.name) {
    return 'Add your full name before downloading your resume.';
  }

  if (!resume.targetJobTitle) {
    return 'Add your target job title before downloading your resume.';
  }

  if (!resume.candidate.contact.email) {
    return 'Add your email address before downloading your resume.';
  }

  if (!resume.candidate.contact.phone) {
    return 'Add your phone number before downloading your resume.';
  }

  if (!resume.candidate.contact.location) {
    return 'Add your location before downloading your resume.';
  }

  return undefined;
}

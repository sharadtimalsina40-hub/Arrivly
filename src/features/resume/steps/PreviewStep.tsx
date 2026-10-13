import TemplatePicker from '../components/TemplatePicker';
import ResumeWritingProposalPanel, {
  type ResumeWritingGenerationStatus,
} from '../ai/resume-writing/ResumeWritingProposalPanel';
import type {
  ResumeWritingReviewAction,
  ResumeWritingReviewState,
} from '../ai/resume-writing/review';
import type {
  GeneratedResumeProposal,
  ResumeWritingInput,
} from '../ai/resume-writing/types';
import FollowUpQuestions from '../follow-up/FollowUpQuestions';
import type { FollowUpAction } from '../follow-up/reducer';
import type {
  FollowUpQuestionBatch,
  FollowUpState,
} from '../follow-up/types';
import JobMatchPanel from '../matching/components/JobMatchPanel';
import type { JobMatchResult } from '../matching/types';
import type { ResumeViewModel } from '../model/preview-model';
import type { TemplateId } from '../model/types';
import { resolveResumeTemplate } from '../templates/registry';

export interface PreviewStepProps {
  readonly model: ResumeViewModel;
  readonly templateId: TemplateId;
  readonly isPdfGenerating: boolean;
  readonly isDocxGenerating: boolean;
  readonly pdfDownloadError?: string;
  readonly pdfDownloadStatus?: string;
  readonly docxDownloadError?: string;
  readonly docxDownloadStatus?: string;
  readonly jobMatchResult?: JobMatchResult;
  readonly followUpQuestionBatch?: FollowUpQuestionBatch;
  readonly followUpState?: FollowUpState;
  readonly followUpAsOfYearMonth: string;
  readonly resumeWritingInput?: ResumeWritingInput;
  readonly resumeWritingEvidenceIndex?: import('../matching/types').CandidateEvidenceIndex;
  readonly resumeWritingStatus?: ResumeWritingGenerationStatus;
  readonly resumeWritingProposal?: GeneratedResumeProposal;
  readonly resumeWritingRejectedStatements?: number;
  readonly resumeWritingError?: string;
  readonly resumeWritingReviewState: ResumeWritingReviewState;
  readonly hasAcceptedResumeWritingSuggestions: boolean;
  readonly validationIssue?: PreviewValidationIssue;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly onDownloadDocx: () => void;
  readonly onDownloadPdf: () => void;
  readonly onPrint: () => void;
  readonly onTemplateChange: (templateId: TemplateId) => void;
  readonly onFollowUpAction: (action: FollowUpAction) => void;
  readonly onGenerateResumeWriting: () => void;
  readonly onResumeWritingReviewAction: (
    action: ResumeWritingReviewAction,
  ) => void;
  readonly onFixValidationIssue: () => void;
  readonly onEditTargetJob: () => void;
  readonly onEditPersonalDetails: () => void;
  readonly onEditExperience: () => void;
  readonly onEditQualifications: () => void;
  readonly onEditAdaptiveAnswers: () => void;
}

export interface PreviewValidationIssue {
  readonly message: string;
  readonly sectionLabel: string;
}

interface ReviewItemProps {
  readonly id: string;
  readonly label: string;
  readonly primary: string;
  readonly secondary?: string;
  readonly editLabel: string;
  readonly onEdit: () => void;
}

function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ReviewItem({
  id,
  label,
  primary,
  secondary,
  editLabel,
  onEdit,
}: ReviewItemProps) {
  return (
    <section
      aria-labelledby={`${id}-review-heading`}
      class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"
    >
      <div class="min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
          {label}
        </p>
        <h3
          id={`${id}-review-heading`}
          tabIndex={-1}
          class="mt-1 break-words text-sm font-bold leading-snug text-white"
        >
          {primary}
        </h3>
        {secondary && (
          <p class="mt-1 break-words text-xs leading-relaxed text-white/60">
            {secondary}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label={editLabel}
        onClick={onEdit}
        class="min-h-10 shrink-0 self-start rounded-full border border-white/25 px-3.5 py-2 text-xs font-bold text-white transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Edit
      </button>
    </section>
  );
}

export default function PreviewStep({
  model,
  templateId,
  isPdfGenerating,
  isDocxGenerating,
  pdfDownloadError,
  pdfDownloadStatus,
  docxDownloadError,
  docxDownloadStatus,
  jobMatchResult,
  followUpQuestionBatch,
  followUpState,
  followUpAsOfYearMonth,
  resumeWritingInput,
  resumeWritingEvidenceIndex,
  resumeWritingStatus = 'idle',
  resumeWritingProposal,
  resumeWritingRejectedStatements,
  resumeWritingError,
  resumeWritingReviewState,
  hasAcceptedResumeWritingSuggestions,
  validationIssue,
  onBack,
  onContinue,
  onDownloadDocx,
  onDownloadPdf,
  onPrint,
  onTemplateChange,
  onFollowUpAction,
  onGenerateResumeWriting,
  onResumeWritingReviewAction,
  onFixValidationIssue,
  onEditTargetJob,
  onEditPersonalDetails,
  onEditExperience,
  onEditQualifications,
  onEditAdaptiveAnswers,
}: PreviewStepProps) {
  const contact = model.candidate.contact;
  const contactDetailCount = [
    contact.phone,
    contact.email,
    contact.location,
    ...(contact.links ?? []).map((link) => link.value),
  ].filter(Boolean).length;
  const experienceCount = model.sections.experience?.length ?? 0;
  const educationCount = model.sections.education?.length ?? 0;
  const skillCount = model.sections.skills?.length ?? 0;
  const licenceCount = model.sections.licences?.length ?? 0;
  const resolvedTemplate = resolveResumeTemplate(templateId);
  const SelectedTemplate = resolvedTemplate.renderer;
  const hasTailoringTools = Boolean(
    (jobMatchResult && followUpQuestionBatch && followUpState) ||
      jobMatchResult ||
      (resumeWritingInput && resumeWritingEvidenceIndex),
  );
  const pdfDescriptionIds = [
    'resume-export-help',
    pdfDownloadError ? 'resume-direct-pdf-error' : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  const docxDescriptionIds = [
    'resume-export-help',
    docxDownloadError ? 'resume-direct-docx-error' : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div class="min-w-0">
      <header class="resume-review-header mb-6 max-w-3xl sm:mb-8">
        <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
          Step 6 of 6
        </p>
        <h2
          id="preview-step-heading"
          tabIndex={-1}
          class="font-serif text-3xl font-light tracking-tight text-white sm:text-4xl"
        >
          Review your resume
        </h2>
        <p class="mt-3 text-sm leading-relaxed text-white/65 sm:text-base">
          Check your details, choose a design and export when you are ready.
        </p>
      </header>

      <div class="resume-review-layout grid gap-6">
        <aside class="resume-review-controls glass rounded-3xl p-5 sm:p-6">
          <div class="mb-5">
            <h3 class="text-base font-bold text-white">Resume details</h3>
            <p class="mt-1 text-xs leading-relaxed text-white/55">
              Use Edit to return to a section.
            </p>
          </div>

          {validationIssue && (
            <section
              role="alert"
              aria-labelledby="review-validation-heading"
              class="mb-5 rounded-2xl border border-red-300/60 bg-red-300/[0.08] p-4"
            >
              <h3
                id="review-validation-heading"
                tabIndex={-1}
                class="text-sm font-bold text-red-100"
              >
                One detail needs attention
              </h3>
              <p class="mt-2 text-sm leading-relaxed text-red-100/85">
                {validationIssue.message}
              </p>
              <button
                type="button"
                aria-label={`Fix ${validationIssue.sectionLabel}`}
                onClick={onFixValidationIssue}
                class="mt-4 min-h-10 rounded-full border border-red-200/60 px-4 py-2 text-xs font-bold text-red-50 transition hover:border-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-100"
              >
                Fix section
              </button>
            </section>
          )}

          <div class="space-y-3">
            <ReviewItem
              id="target-job"
              label="Target job"
              primary={model.targetJobTitle ?? 'No target role added'}
              editLabel="Edit Target Job"
              onEdit={onEditTargetJob}
            />
            <ReviewItem
              id="personal-details"
              label="Personal details"
              primary={model.candidate.name ?? 'No name added'}
              secondary={
                contact.location ?? pluralise(contactDetailCount, 'contact detail')
              }
              editLabel="Edit Personal Details"
              onEdit={onEditPersonalDetails}
            />
            <ReviewItem
              id="experience"
              label="Experience"
              primary={
                experienceCount > 0
                  ? pluralise(experienceCount, 'entry')
                  : 'No experience section'
              }
              editLabel="Edit Experience"
              onEdit={onEditExperience}
            />
            <ReviewItem
              id="qualifications"
              label="Qualifications"
              primary={`${pluralise(educationCount, 'education entry')} · ${pluralise(
                skillCount,
                'skill',
              )}`}
              secondary={pluralise(
                licenceCount,
                'licence or certification',
              )}
              editLabel="Edit Education, Skills and Licences"
              onEdit={onEditQualifications}
            />
            <ReviewItem
              id="adaptive-answers"
              label="Adaptive answers"
              primary="Saved for matching and tailoring"
              editLabel="Edit Adaptive Answers"
              onEdit={onEditAdaptiveAnswers}
            />
          </div>

          <div class="mt-6 grid gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              aria-label="Resume details complete"
              onClick={onContinue}
              class="min-h-11 w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Continue
            </button>
            <button
              type="button"
              aria-label="Back to adaptive questions"
              onClick={onBack}
              class="min-h-11 w-full rounded-full border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:border-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Back
            </button>
          </div>
        </aside>

        <div class="resume-preview-column min-w-0">
          <div class="resume-preview-controls">
            <TemplatePicker
              selectedTemplateId={resolvedTemplate.id}
              onTemplateChange={onTemplateChange}
            />

            <section
              aria-labelledby="resume-export-heading"
              aria-busy={isPdfGenerating || isDocxGenerating}
              class="mb-5 rounded-2xl border border-white/15 bg-white/[0.04] p-4 sm:p-5"
            >
              <div class="mb-4">
                <h3 id="resume-export-heading" class="text-sm font-bold text-white">
                  Export
                </h3>
                <p
                  id="resume-export-help"
                  class="mt-1 text-xs leading-relaxed text-white/60"
                >
                  Print or download the selected design.
                </p>
              </div>

              <div class="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  aria-describedby="resume-export-help"
                  onClick={onPrint}
                  class="min-h-11 min-w-0 whitespace-normal rounded-full border border-white/30 px-4 py-2.5 text-sm font-bold text-white transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Print
                </button>
                <button
                  type="button"
                  disabled={isPdfGenerating}
                  aria-describedby={pdfDescriptionIds}
                  onClick={onDownloadPdf}
                  class="min-h-11 min-w-0 whitespace-normal rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
                >
                  {isPdfGenerating ? 'Generating PDF…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  disabled={isDocxGenerating}
                  aria-describedby={docxDescriptionIds}
                  onClick={onDownloadDocx}
                  class="min-h-11 min-w-0 whitespace-normal rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
                >
                  {isDocxGenerating ? 'Generating Word…' : 'Download Word'}
                </button>
              </div>

              <div class="mt-3 space-y-2">
                {pdfDownloadError && (
                  <p
                    id="resume-direct-pdf-error"
                    role="alert"
                    class="text-xs leading-relaxed text-red-200"
                  >
                    {pdfDownloadError}
                  </p>
                )}
                {pdfDownloadStatus && !pdfDownloadError && (
                  <p role="status" aria-live="polite" class="text-xs text-accent">
                    {pdfDownloadStatus}
                  </p>
                )}
                {docxDownloadError && (
                  <p
                    id="resume-direct-docx-error"
                    role="alert"
                    class="text-xs leading-relaxed text-red-200"
                  >
                    {docxDownloadError}
                  </p>
                )}
                {docxDownloadStatus && !docxDownloadError && (
                  <p role="status" aria-live="polite" class="text-xs text-accent">
                    {docxDownloadStatus}
                  </p>
                )}
              </div>
            </section>

            {hasAcceptedResumeWritingSuggestions && (
              <fieldset class="mb-5 rounded-2xl border border-accent/30 bg-accent/[0.05] p-4 sm:p-5">
                <legend class="px-1 text-sm font-bold text-white">
                  Resume version
                </legend>
                <p
                  id="resume-version-help"
                  class="mt-1 text-xs leading-relaxed text-white/60"
                >
                  Preview and exports use the selected version. Original keeps
                  every master-resume fact untouched.
                </p>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  {(['original', 'tailored'] as const).map((viewMode) => (
                    <label
                      key={viewMode}
                      class={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                        resumeWritingReviewState.viewMode === viewMode
                          ? 'border-accent bg-accent text-ink'
                          : 'border-white/25 text-white hover:border-white/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resume-view-mode"
                        value={viewMode}
                        checked={resumeWritingReviewState.viewMode === viewMode}
                        aria-describedby="resume-version-help"
                        onChange={() =>
                          onResumeWritingReviewAction({
                            type: 'view-mode/changed',
                            viewMode,
                          })
                        }
                        class="sr-only"
                      />
                      {viewMode === 'original' ? 'Original' : 'Tailored'}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onResumeWritingReviewAction({ type: 'all/reset' })
                  }
                  class="mt-3 min-h-10 rounded-full border border-white/25 px-4 py-2 text-xs font-bold text-white transition hover:border-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Reset all AI changes
                </button>
              </fieldset>
            )}

            <h3
              id="resume-document-preview-heading"
              class="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60"
            >
              Resume preview
            </h3>
          </div>

          <div class="resume-print-root" aria-labelledby="resume-document-preview-heading">
            <SelectedTemplate resume={model} />
          </div>

          {hasTailoringTools && (
            <details class="resume-preview-controls glass mt-6 rounded-2xl p-4 sm:p-5">
              <summary class="cursor-pointer select-none text-sm font-bold text-white transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                Job matching and AI writing tools
              </summary>
              <div class="mt-5 min-w-0">
                {jobMatchResult && followUpQuestionBatch && followUpState && (
                  <FollowUpQuestions
                    batch={followUpQuestionBatch}
                    state={followUpState}
                    matchResult={jobMatchResult}
                    asOfYearMonth={followUpAsOfYearMonth}
                    dispatch={onFollowUpAction}
                  />
                )}

                {jobMatchResult && <JobMatchPanel result={jobMatchResult} />}

                {resumeWritingInput && resumeWritingEvidenceIndex && (
                  <ResumeWritingProposalPanel
                    status={resumeWritingStatus}
                    input={resumeWritingInput}
                    displayEvidence={resumeWritingEvidenceIndex}
                    proposal={resumeWritingProposal}
                    rejectedStatements={resumeWritingRejectedStatements}
                    errorMessage={resumeWritingError}
                    reviewState={resumeWritingReviewState}
                    dispatchReview={onResumeWritingReviewAction}
                    onGenerate={onGenerateResumeWriting}
                  />
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'preact/hooks';
import type { JobAnalysisV1 } from './ai/job-analysis/types';
import { buildResumeWritingInput } from './ai/resume-writing/input';
import {
  createInitialResumeWritingReviewState,
  hasAcceptedResumeWritingSuggestions,
  resumeWritingReviewReducer,
  type ResumeWritingReviewAction,
} from './ai/resume-writing/review';
import { buildTailoredResumeViewModel } from './ai/resume-writing/tailored-resume';
import type {
  ResumeWritingInput,
  ValidatedResumeWritingResult,
} from './ai/resume-writing/types';
import {
  buildResumeExportFilename,
  downloadResumeBlob,
} from './export/download';
import {
  addFollowUpEvidence,
  buildConfirmedFollowUpEvidence,
  buildFollowUpConfirmationIndex,
  followUpEvidenceToCandidateEvidence,
  getAustralianYearMonth,
} from './follow-up/evidence';
import { buildFollowUpQuestionBatch } from './follow-up/questions';
import {
  createInitialFollowUpState,
  followUpReducer,
  type FollowUpAction,
} from './follow-up/reducer';
import { buildCandidateEvidenceIndex } from './matching/candidate-evidence';
import { matchJobRequirements } from './matching/matcher';
import { createInitialResumeDraft } from './model/defaults';
import { buildResumeViewModel } from './model/preview-model';
import type { JobAdvertisement, TemplateId } from './model/types';
import {
  validateResumeDraft,
  type ResumeValidationErrors,
} from './model/validation';
import {
  buildResumePdfFilename,
  downloadPdfBlob,
} from './pdf/download';
import {
  resumeDraftReducer,
  type ResumeDraftAction,
} from './state/reducer';
import { getResumeTemplate } from './templates/registry';
import AdaptiveQuestionsStep from './steps/AdaptiveQuestionsStep';
import ExperienceStep from './steps/ExperienceStep';
import PersonalDetailsStep from './steps/PersonalDetailsStep';
import PreviewStep from './steps/PreviewStep';
import QualificationsStep from './steps/QualificationsStep';
import TargetJobStep from './steps/TargetJobStep';

type EditableResumeStep =
  | 'target-job'
  | 'personal-details'
  | 'experience'
  | 'qualifications'
  | 'adaptive-questions';

type ResumeBuilderStep =
  | EditableResumeStep
  | 'preview'
  | 'design-placeholder';

const STEP_HEADING_IDS: Readonly<Record<EditableResumeStep, string>> = {
  'target-job': 'target-job-step-heading',
  'personal-details': 'personal-details-step-heading',
  experience: 'experience-step-heading',
  qualifications: 'qualifications-step-heading',
  'adaptive-questions': 'adaptive-questions-step-heading',
};

const REVIEW_HEADING_IDS: Readonly<Record<EditableResumeStep, string>> = {
  'target-job': 'target-job-review-heading',
  'personal-details': 'personal-details-review-heading',
  experience: 'experience-review-heading',
  qualifications: 'qualifications-review-heading',
  'adaptive-questions': 'adaptive-answers-review-heading',
};

const REVIEW_SECTION_LABELS: Readonly<Record<EditableResumeStep, string>> = {
  'target-job': 'Target Job',
  'personal-details': 'Personal Details',
  experience: 'Experience',
  qualifications: 'Education / Skills / Licences',
  'adaptive-questions': 'Adaptive Answers',
};

interface ReviewValidationIssue {
  readonly step: EditableResumeStep;
  readonly message: string;
}

type JobAnalysisState =
  | { readonly status: 'idle' }
  | { readonly status: 'analysing' }
  | {
      readonly status: 'complete';
      readonly analysis: JobAnalysisV1;
      readonly sourceKey: string;
      readonly message: string;
    }
  | {
      readonly status: 'error';
      readonly message: string;
    };

type ResumeWritingState =
  | { readonly status: 'idle' }
  | { readonly status: 'generating' }
  | {
      readonly status: 'complete';
      readonly contextKey: string;
      readonly input: ResumeWritingInput;
      readonly result: ValidatedResumeWritingResult;
    }
  | { readonly status: 'error'; readonly message: string };

const JOB_ANALYSIS_CACHE_LIMIT = 5;

function getJobAdvertisementSource(
  jobAdvertisement: JobAdvertisement,
): string | null {
  return jobAdvertisement.status === 'provided'
    ? jobAdvertisement.text
    : null;
}

function readCachedJobAnalysis(
  cache: Map<string, JobAnalysisV1>,
  sourceKey: string,
): JobAnalysisV1 | undefined {
  const cachedAnalysis = cache.get(sourceKey);

  if (cachedAnalysis) {
    // Refresh insertion order so the oldest unused result is evicted first.
    cache.delete(sourceKey);
    cache.set(sourceKey, cachedAnalysis);
  }

  return cachedAnalysis;
}

function cacheSuccessfulJobAnalysis(
  cache: Map<string, JobAnalysisV1>,
  sourceKey: string,
  analysis: JobAnalysisV1,
) {
  cache.delete(sourceKey);
  cache.set(sourceKey, analysis);

  if (cache.size > JOB_ANALYSIS_CACHE_LIMIT) {
    const oldestSourceKey = cache.keys().next().value;

    if (oldestSourceKey !== undefined) {
      cache.delete(oldestSourceKey);
    }
  }
}

const VALIDATION_STEP_ORDER: readonly EditableResumeStep[] = [
  'target-job',
  'personal-details',
  'experience',
  'qualifications',
  'adaptive-questions',
];

function validationPathBelongsToStep(
  path: string,
  step: EditableResumeStep,
): boolean {
  switch (step) {
    case 'target-job':
      return (
        path === 'targetJob.desiredTitle' ||
        path.startsWith('targetJob.jobAdvertisement')
      );
    case 'personal-details':
      return path.startsWith('personalDetails.');
    case 'experience':
      return (
        path.startsWith('experience.') ||
        path.startsWith('experienceInput.')
      );
    case 'qualifications':
      return (
        path.startsWith('education.') ||
        path.startsWith('skills.') ||
        path.startsWith('licences.')
      );
    case 'adaptive-questions':
      return path.startsWith('targetJob.occupation.');
  }
}

function findFirstValidationIssue(
  errors: ResumeValidationErrors,
): ReviewValidationIssue | undefined {
  const entries = Object.entries(errors);

  for (const step of VALIDATION_STEP_ORDER) {
    const matchingEntry = entries.find(([path]) =>
      validationPathBelongsToStep(path, step),
    );

    if (matchingEntry) {
      return {
        step,
        message: matchingEntry[1],
      };
    }
  }

  return undefined;
}

export default function ResumeApp() {
  const [draft, reduceDraft] = useReducer(
    resumeDraftReducer,
    undefined,
    createInitialResumeDraft,
  );
  const [followUpState, reduceFollowUp] = useReducer(
    followUpReducer,
    undefined,
    () => createInitialFollowUpState(),
  );
  const [resumeWritingReviewState, reduceResumeWritingReview] = useReducer(
    resumeWritingReviewReducer,
    undefined,
    () => createInitialResumeWritingReviewState(),
  );
  const [currentStep, setCurrentStep] =
    useState<ResumeBuilderStep>('target-job');
  const [reviewEditOrigin, setReviewEditOrigin] =
    useState<EditableResumeStep | null>(null);
  const [reviewValidationIssue, setReviewValidationIssue] =
    useState<ReviewValidationIssue | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(
    null,
  );
  const [pdfDownloadStatus, setPdfDownloadStatus] = useState<
    string | null
  >(null);
  const [isDocxGenerating, setIsDocxGenerating] = useState(false);
  const [docxDownloadError, setDocxDownloadError] = useState<
    string | null
  >(null);
  const [docxDownloadStatus, setDocxDownloadStatus] = useState<
    string | null
  >(null);
  const [jobAnalysisState, setJobAnalysisState] =
    useState<JobAnalysisState>({ status: 'idle' });
  const [resumeWritingState, setResumeWritingState] =
    useState<ResumeWritingState>({ status: 'idle' });
  const pdfGenerationLock = useRef(false);
  const docxGenerationLock = useRef(false);
  const pdfFeedbackVersion = useRef(0);
  const docxFeedbackVersion = useRef(0);
  const jobAnalysisCache = useRef(new Map<string, JobAnalysisV1>());
  const jobAnalysisController = useRef<AbortController | null>(null);
  const jobAnalysisGeneration = useRef(0);
  const jobAnalysisRequestLock = useRef(false);
  const resumeWritingController = useRef<AbortController | null>(null);
  const resumeWritingGeneration = useRef(0);
  const resumeWritingRequestLock = useRef(false);
  const resumeWritingContextKeyRef = useRef<string | null>(null);
  const currentJobAdvertisementSource = getJobAdvertisementSource(
    draft.targetJob.jobAdvertisement,
  );
  const jobAdvertisementSource = useRef<string | null>(
    currentJobAdvertisementSource,
  );
  jobAdvertisementSource.current = currentJobAdvertisementSource;
  const originalPreviewModel = useMemo(
    () => buildResumeViewModel(draft),
    [draft],
  );
  const activeResumeWritingProposal =
    resumeWritingState.status === 'complete' &&
    resumeWritingReviewState.contextKey === resumeWritingState.contextKey
      ? resumeWritingState.result.proposal
      : undefined;
  const hasAcceptedWriting =
    activeResumeWritingProposal !== undefined &&
    hasAcceptedResumeWritingSuggestions(
      resumeWritingReviewState,
      activeResumeWritingProposal,
    );
  const tailoredPreviewModel = useMemo(
    () =>
      activeResumeWritingProposal
        ? buildTailoredResumeViewModel(
            originalPreviewModel,
            activeResumeWritingProposal,
            resumeWritingReviewState,
          )
        : originalPreviewModel,
    [
      activeResumeWritingProposal,
      originalPreviewModel,
      resumeWritingReviewState,
    ],
  );
  const previewModel =
    hasAcceptedWriting && resumeWritingReviewState.viewMode === 'tailored'
      ? tailoredPreviewModel
      : originalPreviewModel;
  const SelectedTemplate = getResumeTemplate(draft.preferences.templateId);
  const completedJobAnalysis =
    jobAnalysisState.status === 'complete'
      ? jobAnalysisState.analysis
      : undefined;
  const completedJobAnalysisContextKey =
    jobAnalysisState.status === 'complete'
      ? jobAnalysisState.sourceKey
      : undefined;
  const canonicalEvidenceIndex = useMemo(
    () => buildCandidateEvidenceIndex(draft),
    [draft],
  );
  const baselineJobMatchResult = useMemo(
    () =>
      completedJobAnalysis
        ? matchJobRequirements(
            completedJobAnalysis,
            canonicalEvidenceIndex,
          )
        : undefined,
    [canonicalEvidenceIndex, completedJobAnalysis],
  );
  const followUpQuestionBatch = useMemo(
    () =>
      baselineJobMatchResult
        ? buildFollowUpQuestionBatch(baselineJobMatchResult)
        : undefined,
    [baselineJobMatchResult],
  );
  const currentFollowUpQuestions = followUpQuestionBatch?.questions ?? [];
  const matchingAsOfYearMonth = getAustralianYearMonth();
  const followUpContextIsCurrent =
    completedJobAnalysisContextKey !== undefined &&
    followUpState.contextKey === completedJobAnalysisContextKey;
  const confirmedFollowUpEvidence = useMemo(
    () =>
      followUpContextIsCurrent
        ? buildConfirmedFollowUpEvidence(
            currentFollowUpQuestions,
            followUpState,
            matchingAsOfYearMonth,
          )
        : [],
    [
      currentFollowUpQuestions,
      followUpContextIsCurrent,
      followUpState,
      matchingAsOfYearMonth,
    ],
  );
  const enrichedEvidenceIndex = useMemo(
    () =>
      addFollowUpEvidence(
        canonicalEvidenceIndex,
        followUpEvidenceToCandidateEvidence(
          confirmedFollowUpEvidence,
          currentFollowUpQuestions,
        ),
      ),
    [
      canonicalEvidenceIndex,
      confirmedFollowUpEvidence,
      currentFollowUpQuestions,
    ],
  );
  const followUpConfirmationIndex = useMemo(
    () =>
      followUpContextIsCurrent
        ? buildFollowUpConfirmationIndex(
            currentFollowUpQuestions,
            followUpState,
          )
        : { items: [] },
    [currentFollowUpQuestions, followUpContextIsCurrent, followUpState],
  );
  const jobMatchResult = useMemo(
    () =>
      completedJobAnalysis
        ? matchJobRequirements(
            completedJobAnalysis,
            enrichedEvidenceIndex,
            followUpConfirmationIndex,
          )
        : undefined,
    [
      completedJobAnalysis,
      enrichedEvidenceIndex,
      followUpConfirmationIndex,
    ],
  );
  const resumeWritingInput = useMemo(
    () =>
      completedJobAnalysis
        ? buildResumeWritingInput(
            completedJobAnalysis,
            originalPreviewModel,
            enrichedEvidenceIndex,
          )
        : undefined,
    [completedJobAnalysis, enrichedEvidenceIndex, originalPreviewModel],
  );
  const resumeWritingContextKey = useMemo(
    () =>
      resumeWritingInput === undefined
        ? null
        : JSON.stringify(resumeWritingInput),
    [resumeWritingInput],
  );
  resumeWritingContextKeyRef.current = resumeWritingContextKey;

  useEffect(
    () => () => {
      jobAnalysisGeneration.current += 1;
      jobAnalysisController.current?.abort();
      jobAnalysisController.current = null;
      jobAnalysisRequestLock.current = false;
      resumeWritingGeneration.current += 1;
      resumeWritingController.current?.abort();
      resumeWritingController.current = null;
      resumeWritingRequestLock.current = false;
    },
    [],
  );

  function invalidateResumeWriting() {
    resumeWritingGeneration.current += 1;
    resumeWritingController.current?.abort();
    resumeWritingController.current = null;
    resumeWritingRequestLock.current = false;
    setResumeWritingState({ status: 'idle' });
    reduceResumeWritingReview({ type: 'context/reset', contextKey: null });
  }

  function invalidateJobAnalysis() {
    invalidateResumeWriting();
    jobAnalysisGeneration.current += 1;
    jobAnalysisController.current?.abort();
    jobAnalysisController.current = null;
    jobAnalysisRequestLock.current = false;
    reduceFollowUp({ type: 'context/reset', contextKey: null });
    setJobAnalysisState({ status: 'idle' });
  }

  function dispatch(action: ResumeDraftAction) {
    if (action.type !== 'preferences/template-changed') {
      invalidateResumeWriting();
    }

    if (action.type === 'target-job/job-advertisement-changed') {
      const nextSource = getJobAdvertisementSource(
        action.jobAdvertisement,
      );

      if (nextSource !== jobAdvertisementSource.current) {
        // Invalidate synchronously with the edit so an older response cannot
        // briefly appear against a newer advertisement.
        jobAdvertisementSource.current = nextSource;
        invalidateJobAnalysis();
      }
    }

    reduceDraft(action);
  }

  function dispatchFollowUp(action: FollowUpAction) {
    invalidateResumeWriting();
    reduceFollowUp(action);
  }

  function dispatchResumeWritingReview(
    action: ResumeWritingReviewAction,
  ) {
    clearExportFeedback();
    reduceResumeWritingReview(action);
  }

  async function analyseCurrentJobAdvertisement() {
    if (jobAnalysisRequestLock.current) {
      return;
    }

    const jobAdvertisement = draft.targetJob.jobAdvertisement;

    if (
      jobAdvertisement.status !== 'provided' ||
      jobAdvertisement.text.trim().length === 0
    ) {
      setJobAnalysisState({
        status: 'error',
        message: 'Paste a job advertisement before analysing it.',
      });
      return;
    }

    // The trimmed advertisement is the cache identity and the only request
    // content. The cache stays in this component, is bounded, and is never
    // persisted to storage.
    const sourceSnapshot = jobAdvertisement.text;
    const sourceKey = sourceSnapshot.trim();
    const cachedAnalysis = readCachedJobAnalysis(
      jobAnalysisCache.current,
      sourceKey,
    );

    if (cachedAnalysis) {
      reduceFollowUp({ type: 'context/reset', contextKey: sourceKey });
      setJobAnalysisState({
        status: 'complete',
        analysis: cachedAnalysis,
        sourceKey,
        message:
          'Analysis is already up to date. Employer requirements remain separate from your resume facts.',
      });
      return;
    }

    const generation = jobAnalysisGeneration.current + 1;
    jobAnalysisGeneration.current = generation;
    const controller = new AbortController();
    jobAnalysisController.current = controller;
    jobAnalysisRequestLock.current = true;
    setJobAnalysisState({ status: 'analysing' });

    try {
      // Keep validation/provider code out of the initial resume island bundle.
      const client = await import('./ai/job-analysis/client');
      const analysis = await client.requestJobAdvertisementAnalysis(
        sourceSnapshot,
        { signal: controller.signal },
      );

      if (
        controller.signal.aborted ||
        jobAnalysisGeneration.current !== generation ||
        jobAdvertisementSource.current !== sourceSnapshot
      ) {
        return;
      }

      cacheSuccessfulJobAnalysis(
        jobAnalysisCache.current,
        sourceKey,
        analysis,
      );
      reduceFollowUp({ type: 'context/reset', contextKey: sourceKey });
      setJobAnalysisState({
        status: 'complete',
        analysis,
        sourceKey,
        message:
          'Analysis complete. Employer requirements remain separate from your resume facts.',
      });
    } catch (error: unknown) {
      if (
        controller.signal.aborted ||
        jobAnalysisGeneration.current !== generation ||
        jobAdvertisementSource.current !== sourceSnapshot
      ) {
        return;
      }

      setJobAnalysisState({
        status: 'error',
        message:
          error instanceof Error &&
          error.name === 'JobAnalysisClientError'
            ? error.message
            : 'We couldn’t analyse this job advertisement. Please try again.',
      });
    } finally {
      if (jobAnalysisController.current === controller) {
        jobAnalysisController.current = null;
        jobAnalysisRequestLock.current = false;
      }
    }
  }

  async function generateResumeWritingProposal() {
    if (resumeWritingRequestLock.current) {
      return;
    }

    const inputSnapshot = resumeWritingInput;
    const contextKeySnapshot = resumeWritingContextKey;
    const evidenceCount =
      (inputSnapshot?.candidateEvidence.length ?? 0) +
      (inputSnapshot?.confirmedFollowUpEvidence.length ?? 0);

    if (!inputSnapshot || !contextKeySnapshot) {
      setResumeWritingState({
        status: 'error',
        message:
          'Analyse a job advertisement before generating tailored wording.',
      });
      return;
    }

    if (evidenceCount === 0) {
      setResumeWritingState({
        status: 'error',
        message:
          'Add or confirm some resume details before generating tailored wording.',
      });
      return;
    }

    const generation = resumeWritingGeneration.current + 1;
    resumeWritingGeneration.current = generation;
    const controller = new AbortController();
    resumeWritingController.current = controller;
    resumeWritingRequestLock.current = true;
    reduceResumeWritingReview({
      type: 'context/reset',
      contextKey: contextKeySnapshot,
    });
    setResumeWritingState({ status: 'generating' });

    try {
      const client = await import('./ai/resume-writing/client');
      const result = await client.requestResumeWritingProposal(
        inputSnapshot,
        { signal: controller.signal },
      );

      if (
        controller.signal.aborted ||
        resumeWritingGeneration.current !== generation ||
        resumeWritingContextKeyRef.current !== contextKeySnapshot
      ) {
        return;
      }

      setResumeWritingState({
        status: 'complete',
        contextKey: contextKeySnapshot,
        input: inputSnapshot,
        result,
      });
    } catch (error: unknown) {
      if (
        controller.signal.aborted ||
        resumeWritingGeneration.current !== generation ||
        resumeWritingContextKeyRef.current !== contextKeySnapshot
      ) {
        return;
      }

      setResumeWritingState({
        status: 'error',
        message:
          error instanceof Error &&
          error.name === 'ResumeWritingClientError'
            ? error.message
            : 'We couldn’t create grounded resume suggestions. Please try again.',
      });
    } finally {
      if (resumeWritingController.current === controller) {
        resumeWritingController.current = null;
        resumeWritingRequestLock.current = false;
      }
    }
  }

  function moveToStep(step: ResumeBuilderStep, headingId: string) {
    setCurrentStep(step);
    requestAnimationFrame(() => {
      document.getElementById(headingId)?.focus();
    });
  }

  function clearPdfFeedback(): number {
    const nextVersion = pdfFeedbackVersion.current + 1;
    pdfFeedbackVersion.current = nextVersion;
    setPdfDownloadError(null);
    setPdfDownloadStatus(null);
    return nextVersion;
  }

  function clearDocxFeedback(): number {
    const nextVersion = docxFeedbackVersion.current + 1;
    docxFeedbackVersion.current = nextVersion;
    setDocxDownloadError(null);
    setDocxDownloadStatus(null);
    return nextVersion;
  }

  function clearExportFeedback() {
    clearPdfFeedback();
    clearDocxFeedback();
  }

  function changeTemplate(templateId: TemplateId) {
    clearExportFeedback();
    dispatch({
      type: 'preferences/template-changed',
      templateId,
      at: new Date().toISOString(),
    });
  }

  function printResume() {
    window.print();
  }

  async function downloadResumePdf() {
    if (pdfGenerationLock.current) {
      return;
    }

    const feedbackVersion = clearPdfFeedback();

    const validation = validateResumeDraft(draft);

    if (!validation.valid) {
      if (!showReviewValidationIssue(validation.errors)) {
        if (pdfFeedbackVersion.current === feedbackVersion) {
          setPdfDownloadError(
            'Check the resume details before trying the PDF download again.',
          );
        }
      }
      return;
    }

    pdfGenerationLock.current = true;
    setIsPdfGenerating(true);

    try {
      // Snapshot both presentation and facts at click time. The generator
      // never receives the raw draft, job advertisement or adaptive answers.
      const templateIdSnapshot = draft.preferences.templateId;
      const resumeSnapshot = previewModel;
      const pdfModule = await import('./pdf/generate-resume-pdf');
      const blob = await pdfModule.generateResumePdf(
        resumeSnapshot,
        templateIdSnapshot,
      );

      downloadPdfBlob(blob, buildResumePdfFilename(resumeSnapshot));
      if (pdfFeedbackVersion.current === feedbackVersion) {
        setPdfDownloadStatus('Your PDF download should begin shortly.');
      }
    } catch (error: unknown) {
      if (pdfFeedbackVersion.current === feedbackVersion) {
        setPdfDownloadError(
          error instanceof Error &&
            error.name === 'ResumePdfValidationError'
            ? error.message
            : 'We couldn’t create the PDF. Try again or use browser print.',
        );
      }
    } finally {
      pdfGenerationLock.current = false;
      setIsPdfGenerating(false);
    }
  }

  async function downloadResumeDocx() {
    if (docxGenerationLock.current) {
      return;
    }

    const feedbackVersion = clearDocxFeedback();

    const validation = validateResumeDraft(draft);

    if (!validation.valid) {
      if (!showReviewValidationIssue(validation.errors)) {
        if (docxFeedbackVersion.current === feedbackVersion) {
          setDocxDownloadError(
            'Check the resume details before trying the Word download again.',
          );
        }
      }
      return;
    }

    docxGenerationLock.current = true;
    setIsDocxGenerating(true);

    try {
      // Snapshot presentation and facts at click time. Only the resume-ready
      // factual projection reaches the selected Word renderer.
      const templateIdSnapshot = draft.preferences.templateId;
      const resumeSnapshot = previewModel;
      const docxModule = await import('./docx/generate-resume-docx');
      const blob = await docxModule.generateResumeDocx(
        resumeSnapshot,
        templateIdSnapshot,
      );

      downloadResumeBlob(
        blob,
        buildResumeExportFilename(resumeSnapshot, 'docx'),
      );
      if (docxFeedbackVersion.current === feedbackVersion) {
        setDocxDownloadStatus(
          'Your Word document download should begin shortly.',
        );
      }
    } catch (error: unknown) {
      if (docxFeedbackVersion.current === feedbackVersion) {
        setDocxDownloadError(
          error instanceof Error &&
            error.name === 'ResumeDocxValidationError'
            ? error.message
            : 'We couldn’t create the Word document. Try again.',
        );
      }
    } finally {
      docxGenerationLock.current = false;
      setIsDocxGenerating(false);
    }
  }

  function beginReviewEdit(step: EditableResumeStep) {
    clearExportFeedback();
    setReviewValidationIssue(null);
    setReviewEditOrigin(step);
    moveToStep(step, STEP_HEADING_IDS[step]);
  }

  function returnToReview(focusStep?: EditableResumeStep) {
    clearExportFeedback();
    setReviewValidationIssue(null);
    setReviewEditOrigin(null);
    moveToStep(
      'preview',
      focusStep ? REVIEW_HEADING_IDS[focusStep] : 'preview-step-heading',
    );
  }

  function showReviewValidationIssue(
    errors: ResumeValidationErrors,
  ): boolean {
    const issue = findFirstValidationIssue(errors);

    if (!issue) {
      return false;
    }

    setReviewEditOrigin(null);
    setReviewValidationIssue(issue);
    moveToStep('preview', 'review-validation-heading');
    return true;
  }

  function validateAndReturnToReview() {
    const result = validateResumeDraft(draft);

    if (!result.valid && showReviewValidationIssue(result.errors)) {
      return;
    }

    returnToReview(reviewEditOrigin ?? undefined);
  }

  function continueFromStep(
    nextStep: ResumeBuilderStep,
    nextHeadingId: string,
  ) {
    if (reviewEditOrigin !== null) {
      validateAndReturnToReview();
      return;
    }

    moveToStep(nextStep, nextHeadingId);
  }

  function backFromStep(
    previousStep: EditableResumeStep,
    previousHeadingId: string,
  ) {
    if (reviewEditOrigin !== null) {
      returnToReview(reviewEditOrigin);
      return;
    }

    moveToStep(previousStep, previousHeadingId);
  }

  function continueFromReview() {
    const result = validateResumeDraft(draft);

    if (!result.valid && showReviewValidationIssue(result.errors)) {
      return;
    }

    setReviewValidationIssue(null);
    setReviewEditOrigin(null);
    moveToStep('design-placeholder', 'design-placeholder-heading');
  }

  if (currentStep === 'preview') {
    return (
      <section aria-label="Resume review and preview">
        <PreviewStep
          model={previewModel}
          templateId={draft.preferences.templateId}
          isPdfGenerating={isPdfGenerating}
          isDocxGenerating={isDocxGenerating}
          pdfDownloadError={pdfDownloadError ?? undefined}
          pdfDownloadStatus={pdfDownloadStatus ?? undefined}
          docxDownloadError={docxDownloadError ?? undefined}
          docxDownloadStatus={docxDownloadStatus ?? undefined}
          jobMatchResult={jobMatchResult}
          followUpQuestionBatch={
            followUpContextIsCurrent ? followUpQuestionBatch : undefined
          }
          followUpState={
            followUpContextIsCurrent ? followUpState : undefined
          }
          followUpAsOfYearMonth={matchingAsOfYearMonth}
          resumeWritingInput={
            resumeWritingState.status === 'complete'
              ? resumeWritingState.input
              : resumeWritingInput
          }
          resumeWritingEvidenceIndex={enrichedEvidenceIndex}
          resumeWritingStatus={resumeWritingState.status}
          resumeWritingProposal={
            resumeWritingState.status === 'complete'
              ? resumeWritingState.result.proposal
              : undefined
          }
          resumeWritingRejectedStatements={
            resumeWritingState.status === 'complete'
              ? resumeWritingState.result.rejectedStatements
              : undefined
          }
          resumeWritingError={
            resumeWritingState.status === 'error'
              ? resumeWritingState.message
              : undefined
          }
          resumeWritingReviewState={resumeWritingReviewState}
          hasAcceptedResumeWritingSuggestions={hasAcceptedWriting}
          onFollowUpAction={dispatchFollowUp}
          onGenerateResumeWriting={generateResumeWritingProposal}
          onResumeWritingReviewAction={dispatchResumeWritingReview}
          validationIssue={
            reviewValidationIssue
              ? {
                  message: reviewValidationIssue.message,
                  sectionLabel:
                    REVIEW_SECTION_LABELS[reviewValidationIssue.step],
                }
              : undefined
          }
          onBack={() => {
            clearExportFeedback();
            setReviewValidationIssue(null);
            setReviewEditOrigin(null);
            moveToStep(
              'adaptive-questions',
              'adaptive-questions-step-heading',
            );
          }}
          onContinue={continueFromReview}
          onDownloadDocx={downloadResumeDocx}
          onDownloadPdf={downloadResumePdf}
          onPrint={printResume}
          onTemplateChange={changeTemplate}
          onFixValidationIssue={() => {
            if (reviewValidationIssue) {
              beginReviewEdit(reviewValidationIssue.step);
            }
          }}
          onEditTargetJob={() => beginReviewEdit('target-job')}
          onEditPersonalDetails={() => beginReviewEdit('personal-details')}
          onEditExperience={() => beginReviewEdit('experience')}
          onEditQualifications={() => beginReviewEdit('qualifications')}
          onEditAdaptiveAnswers={() =>
            beginReviewEdit('adaptive-questions')
          }
        />
      </section>
    );
  }

  if (currentStep === 'design-placeholder') {
    return (
      <section aria-label="Resume design placeholder">
        <div class="glass rounded-3xl p-6 sm:p-8">
          <p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            Phase 2 complete
          </p>
          <h2
            id="design-placeholder-heading"
            tabIndex={-1}
            class="mb-3 font-serif text-2xl font-light tracking-tight text-white sm:text-3xl"
          >
            Resume details complete
          </h2>
          <p class="max-w-xl text-sm leading-relaxed text-white/70">
            Your structured resume data, three design options and matching
            direct PDF and Word exports are ready. Evidence-grounded AI
            wording proposals can be applied as a reversible tailored layer
            while your original resume facts remain unchanged.
          </p>
          <button
            type="button"
            onClick={() => moveToStep('preview', 'preview-step-heading')}
            class="mt-7 rounded-full border border-white/25 px-7 py-3 text-sm font-bold text-white transition hover:border-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Back to resume review
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Resume builder">
      <div class="resume-builder-layout grid gap-6">
        <div class="resume-builder-controls min-w-0">
          {currentStep === 'target-job' ? (
            <TargetJobStep
              draft={draft}
              dispatch={dispatch}
              jobAnalysis={
                jobAnalysisState.status === 'complete'
                  ? jobAnalysisState.analysis
                  : undefined
              }
              jobAnalysisStatus={jobAnalysisState.status}
              jobAnalysisMessage={
                jobAnalysisState.status === 'complete'
                  ? jobAnalysisState.message
                  : jobAnalysisState.status === 'error'
                    ? jobAnalysisState.message
                    : undefined
              }
              onAnalyseJob={analyseCurrentJobAdvertisement}
              onBack={
                reviewEditOrigin !== null
                  ? () => returnToReview(reviewEditOrigin)
                  : undefined
              }
              onContinue={() =>
                continueFromStep(
                  'personal-details',
                  'personal-details-step-heading',
                )
              }
              backLabel="Back to review"
              continueLabel={
                reviewEditOrigin !== null
                  ? 'Check and return to review'
                  : undefined
              }
            />
          ) : currentStep === 'personal-details' ? (
            <PersonalDetailsStep
              draft={draft}
              dispatch={dispatch}
              onBack={() =>
                backFromStep('target-job', 'target-job-step-heading')
              }
              onContinue={() =>
                continueFromStep('experience', 'experience-step-heading')
              }
              backLabel={
                reviewEditOrigin !== null ? 'Back to review' : undefined
              }
              continueLabel={
                reviewEditOrigin !== null
                  ? 'Check and return to review'
                  : undefined
              }
            />
          ) : currentStep === 'experience' ? (
            <ExperienceStep
              draft={draft}
              dispatch={dispatch}
              onBack={() =>
                backFromStep(
                  'personal-details',
                  'personal-details-step-heading',
                )
              }
              onContinue={() =>
                continueFromStep(
                  'qualifications',
                  'qualifications-step-heading',
                )
              }
              backLabel={
                reviewEditOrigin !== null ? 'Back to review' : undefined
              }
              continueLabel={
                reviewEditOrigin !== null
                  ? 'Check and return to review'
                  : undefined
              }
            />
          ) : currentStep === 'qualifications' ? (
            <QualificationsStep
              draft={draft}
              dispatch={dispatch}
              onBack={() =>
                backFromStep('experience', 'experience-step-heading')
              }
              onContinue={() =>
                continueFromStep(
                  'adaptive-questions',
                  'adaptive-questions-step-heading',
                )
              }
              backLabel={
                reviewEditOrigin !== null ? 'Back to review' : undefined
              }
              continueLabel={
                reviewEditOrigin !== null
                  ? 'Check and return to review'
                  : undefined
              }
            />
          ) : (
            <AdaptiveQuestionsStep
              draft={draft}
              dispatch={dispatch}
              onBack={() =>
                backFromStep(
                  'qualifications',
                  'qualifications-step-heading',
                )
              }
              onContinue={() =>
                continueFromStep('preview', 'preview-step-heading')
              }
              backLabel={
                reviewEditOrigin !== null ? 'Back to review' : undefined
              }
              continueLabel={
                reviewEditOrigin !== null
                  ? 'Check and return to review'
                  : undefined
              }
            />
          )}
        </div>

        <aside
          aria-label="Live resume preview"
          class="resume-preview-column min-w-0"
        >
          <div class="resume-preview-controls">
            <p class="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
              Live resume preview
            </p>
          </div>
          <div class="resume-print-root">
            <SelectedTemplate resume={previewModel} />
          </div>
        </aside>
      </div>
    </section>
  );
}

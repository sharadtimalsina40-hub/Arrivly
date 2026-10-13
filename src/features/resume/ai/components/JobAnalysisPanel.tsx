import type {
  EvidenceBackedJobAnalysisItem,
  JobAnalysisV1,
  JobRequirement,
} from '../job-analysis/types';

export interface JobAnalysisPanelProps {
  readonly analysis: JobAnalysisV1;
}

interface AnalysisListProps {
  readonly heading: string;
  readonly items: readonly string[];
}

function AnalysisList({ heading, items }: AnalysisListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h4 class="text-sm font-bold text-white">{heading}</h4>
      <ul class="mt-2 space-y-1.5 pl-5 text-sm leading-relaxed text-white/75">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} class="list-disc marker:text-accent">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function requirementNames(items: readonly JobRequirement[]): string[] {
  return items.map((item) => item.name);
}

function itemValues(
  items: readonly EvidenceBackedJobAnalysisItem[],
): string[] {
  return items.map((item) => item.value);
}

/** Temporary structured development view. This component never edits a draft. */
export default function JobAnalysisPanel({
  analysis,
}: JobAnalysisPanelProps) {
  const hasExtractedContent =
    analysis.jobTitle !== null ||
    analysis.employer !== null ||
    analysis.requiredSkills.length > 0 ||
    analysis.preferredSkills.length > 0 ||
    analysis.responsibilities.length > 0 ||
    analysis.qualifications.length > 0 ||
    analysis.certifications.length > 0 ||
    analysis.softSkills.length > 0 ||
    analysis.keywords.length > 0 ||
    analysis.experienceRequirements.length > 0 ||
    analysis.otherRequirements.length > 0;

  return (
    <section
      id="job-analysis-development-panel"
      aria-labelledby="job-analysis-development-heading"
      class="mt-5 rounded-2xl border border-accent/25 bg-accent/[0.055] p-4 sm:p-5"
    >
      <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
        Development preview
      </p>
      <h3
        id="job-analysis-development-heading"
        class="mt-2 font-serif text-xl font-light text-white"
      >
        Job analysis
      </h3>
      <p class="mt-2 text-xs leading-relaxed text-white/65">
        These are employer requirements only. They have not been added to
        your skills, experience or resume.
      </p>

      {(analysis.jobTitle || analysis.employer) && (
        <dl class="mt-5 grid gap-3 sm:grid-cols-2">
          {analysis.jobTitle && (
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-white/55">
                Advertised role
              </dt>
              <dd class="mt-1 text-sm text-white">
                {analysis.jobTitle.value}
              </dd>
            </div>
          )}
          {analysis.employer && (
            <div>
              <dt class="text-xs font-bold uppercase tracking-wide text-white/55">
                Employer
              </dt>
              <dd class="mt-1 text-sm text-white">
                {analysis.employer.value}
              </dd>
            </div>
          )}
        </dl>
      )}

      {hasExtractedContent ? (
        <div class="mt-5 grid gap-5 sm:grid-cols-2">
          <AnalysisList
            heading="Required skills"
            items={requirementNames(analysis.requiredSkills)}
          />
          <AnalysisList
            heading="Preferred skills"
            items={requirementNames(analysis.preferredSkills)}
          />
          <AnalysisList
            heading="Responsibilities"
            items={itemValues(analysis.responsibilities)}
          />
          <AnalysisList
            heading="Qualifications"
            items={itemValues(analysis.qualifications)}
          />
          <AnalysisList
            heading="Certifications"
            items={itemValues(analysis.certifications)}
          />
          <AnalysisList
            heading="Soft skills"
            items={itemValues(analysis.softSkills)}
          />
          <AnalysisList
            heading="Experience requirements"
            items={itemValues(analysis.experienceRequirements)}
          />
          <AnalysisList
            heading="Other requirements"
            items={itemValues(analysis.otherRequirements)}
          />
          <AnalysisList
            heading="Keywords"
            items={itemValues(analysis.keywords)}
          />
        </div>
      ) : (
        <p class="mt-5 text-sm text-white/70">
          No supported requirements were found in this advertisement.
        </p>
      )}
    </section>
  );
}

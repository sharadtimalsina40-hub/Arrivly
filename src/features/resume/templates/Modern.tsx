import type { ResumeContactViewModel } from '../model/preview-model';
import type { ResumeTemplateProps } from './registry';

const PROFESSIONAL_LINK_LABELS = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
} as const;

function hasContactDetails(contact: ResumeContactViewModel): boolean {
  return Boolean(
    contact.phone ||
      contact.email ||
      contact.location ||
      contact.links?.length,
  );
}

const SECTION_CLASS = 'mt-8';
const SECTION_HEADING_CLASS =
  'mb-5 border-b border-[#d9e2c1] border-l-4 border-l-accent pb-2 pl-3 text-sm font-bold uppercase tracking-[0.18em] text-[#26352d]';
const ENTRY_CLASS = 'min-w-0 break-words';

export default function Modern({ resume }: ResumeTemplateProps) {
  const contact = resume.candidate.contact;
  const hasContact = hasContactDetails(contact);

  return (
    <article
      aria-label="Modern resume"
      data-resume-template="modern"
      class="resume-document mx-auto w-full max-w-[210mm] min-w-0 rounded-xl border-t-[6px] border-accent bg-white p-5 font-sans text-ink shadow-2xl sm:p-8 md:p-10"
    >
      {(resume.candidate.name || resume.targetJobTitle || hasContact) && (
        <header class="min-w-0 break-words border-b border-black/10 pb-7">
          {resume.candidate.name && (
            <h2 class="text-3xl font-bold leading-[1.05] tracking-[-0.035em] text-[#17231d] sm:text-4xl">
              {resume.candidate.name}
            </h2>
          )}

          {resume.targetJobTitle && (
            <p class="mt-3 text-base font-medium text-[#405047]">
              <span class="font-bold text-[#17231d]">Target role:</span>{' '}
              {resume.targetJobTitle}
            </p>
          )}

          {hasContact && (
            <address class="mt-5 space-y-1 text-sm not-italic leading-relaxed text-muted">
              {contact.phone && (
                <p>
                  <span class="font-bold text-[#17231d]">Phone:</span>{' '}
                  {contact.phone}
                </p>
              )}
              {contact.email && (
                <p class="break-words">
                  <span class="font-bold text-[#17231d]">Email:</span>{' '}
                  {contact.email}
                </p>
              )}
              {contact.location && (
                <p>
                  <span class="font-bold text-[#17231d]">Location:</span>{' '}
                  {contact.location}
                </p>
              )}
              {contact.links?.map((link) => (
                <p
                  key={link.kind}
                  class="break-words"
                >
                  <span class="font-bold text-[#17231d]">
                    {PROFESSIONAL_LINK_LABELS[link.kind]}:
                  </span>{' '}
                  {link.value}
                </p>
              ))}
            </address>
          )}
        </header>
      )}

      {resume.summary && (
        <section class={SECTION_CLASS}>
          <h3 class={SECTION_HEADING_CLASS}>Professional summary</h3>
          <p class="whitespace-pre-line text-sm leading-relaxed text-ink">
            {resume.summary}
          </p>
        </section>
      )}

      {resume.sections.experience?.length ? (
        <section class={SECTION_CLASS}>
          <h3 class={SECTION_HEADING_CLASS}>Experience</h3>
          <ol role="list" class="list-none space-y-7 p-0">
            {resume.sections.experience.map((entry) => (
              <li key={entry.id}>
                <div class={ENTRY_CLASS}>
                  {entry.roleTitle && (
                    <h4 class="text-lg font-bold leading-snug text-[#17231d]">
                      {entry.roleTitle}
                    </h4>
                  )}
                  {(entry.organisation || entry.location) && (
                    <p class="mt-1 text-sm font-semibold text-[#405047]">
                      {entry.organisation}
                      {entry.organisation && entry.location ? ' · ' : ''}
                      {entry.location}
                    </p>
                  )}
                  {entry.dateRange && (
                    <p class="mt-1 text-sm text-muted">{entry.dateRange}</p>
                  )}
                  {entry.description && (
                    <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
                      {entry.description}
                    </p>
                  )}
                  {entry.highlights?.length ? (
                    <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-[#667a2c]">
                      {entry.highlights.map((highlight) => (
                        <li
                          key={highlight.sourceFactId}
                          class="whitespace-pre-line"
                        >
                          {highlight.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {resume.sections.education?.length ? (
        <section class={SECTION_CLASS}>
          <h3 class={SECTION_HEADING_CLASS}>Education</h3>
          <ol role="list" class="list-none space-y-6 p-0">
            {resume.sections.education.map((entry) => (
              <li key={entry.id}>
                <div class={ENTRY_CLASS}>
                  {entry.qualification && (
                    <h4 class="text-lg font-bold leading-snug text-[#17231d]">
                      {entry.qualification}
                    </h4>
                  )}
                  {entry.fieldOfStudy && (
                    <p class="mt-1 text-sm font-medium text-ink">
                      {entry.fieldOfStudy}
                    </p>
                  )}
                  {(entry.institution || entry.location) && (
                    <p class="mt-1 text-sm font-semibold text-[#405047]">
                      {entry.institution}
                      {entry.institution && entry.location ? ' · ' : ''}
                      {entry.location}
                    </p>
                  )}
                  {entry.dateRange && (
                    <p class="mt-1 text-sm text-muted">{entry.dateRange}</p>
                  )}
                  <p class="mt-1 text-sm text-muted">{entry.statusLine}</p>
                  {entry.highlights?.length ? (
                    <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-[#667a2c]">
                      {entry.highlights.map((highlight) => (
                        <li
                          key={highlight.sourceFactId}
                          class="whitespace-pre-line"
                        >
                          {highlight.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {resume.sections.skills?.length ? (
        <section class={SECTION_CLASS}>
          <h3 class={SECTION_HEADING_CLASS}>Skills</h3>
          <ul class="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-[#667a2c]">
            {resume.sections.skills.map((skill) => (
              <li
                key={skill.id}
                class="break-words"
              >
                {skill.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {resume.sections.licences?.length ? (
        <section class={SECTION_CLASS}>
          <h3 class={SECTION_HEADING_CLASS}>Licences and certifications</h3>
          <ol role="list" class="list-none space-y-6 p-0">
            {resume.sections.licences.map((entry) => (
              <li key={entry.id}>
                <div class={ENTRY_CLASS}>
                  {entry.name && (
                    <h4 class="text-lg font-bold leading-snug text-[#17231d]">
                      {entry.name}
                    </h4>
                  )}
                  {entry.authority && (
                    <p class="mt-1 text-sm font-semibold text-[#405047]">
                      {entry.authority}
                    </p>
                  )}
                  <p class="mt-1 text-sm text-muted">{entry.statusLine}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}

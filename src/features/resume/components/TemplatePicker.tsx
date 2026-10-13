import type { TemplateId } from '../model/types';
import { resumeTemplateOptions } from '../templates/registry';

export interface TemplatePickerProps {
  readonly selectedTemplateId: TemplateId;
  readonly onTemplateChange: (templateId: TemplateId) => void;
}

export default function TemplatePicker({
  selectedTemplateId,
  onTemplateChange,
}: TemplatePickerProps) {
  return (
    <fieldset
      aria-describedby="resume-template-picker-help"
      class="mb-5 rounded-2xl border border-white/15 bg-white/[0.04] p-4"
    >
      <legend class="px-1 text-sm font-bold text-white">
        Resume template
      </legend>
      <p
        id="resume-template-picker-help"
        class="mb-3 mt-1 text-xs leading-relaxed text-white/60"
      >
        Change the presentation without changing your resume content.
      </p>

      <div class="grid gap-2 sm:grid-cols-3">
        {resumeTemplateOptions.map((option) => {
          const isSelected = selectedTemplateId === option.id;

          return (
            <label
              key={option.id}
              class={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                isSelected
                  ? 'border-accent bg-accent/[0.09]'
                  : 'border-white/20 bg-black/10 hover:border-white/40'
              }`}
            >
              <input
                type="radio"
                name="resume-template"
                value={option.id}
                checked={isSelected}
                onChange={() => {
                  if (!isSelected) {
                    onTemplateChange(option.id);
                  }
                }}
                class="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span class="min-w-0">
                <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-white">
                  {option.label}
                  {isSelected && (
                    <span class="text-[10px] uppercase tracking-[0.12em] text-accent">
                      Selected
                    </span>
                  )}
                </span>
                <span class="mt-1 block text-xs leading-relaxed text-white/55">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

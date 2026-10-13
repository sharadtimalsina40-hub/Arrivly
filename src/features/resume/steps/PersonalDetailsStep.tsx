import type { TargetedEvent } from 'preact';
import { useState } from 'preact/hooks';
import type {
  AustralianStateOrTerritory,
  ProfessionalLinks,
  ResumeDraftV1,
  ResumeLocation,
} from '../model/types';
import { validateResumeDraft } from '../model/validation';
import type { ResumeDraftAction } from '../state/reducer';

export interface PersonalDetailsStepProps {
  readonly draft: ResumeDraftV1;
  readonly dispatch: (action: ResumeDraftAction) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly backLabel?: string;
  readonly continueLabel?: string;
}

interface FieldErrorProps {
  readonly id: string;
  readonly message: string | undefined;
}

const AUSTRALIAN_STATES = [
  'ACT',
  'NSW',
  'NT',
  'QLD',
  'SA',
  'TAS',
  'VIC',
  'WA',
] as const satisfies readonly AustralianStateOrTerritory[];

const STEP_VALIDATION_FIELDS = [
  {
    path: 'personalDetails.fullName',
    fieldId: 'personal-details-full-name',
  },
  {
    path: 'personalDetails.email',
    fieldId: 'personal-details-email',
  },
  {
    path: 'personalDetails.phone',
    fieldId: 'personal-details-phone',
  },
  {
    path: 'personalDetails.location.city',
    fieldId: 'personal-details-city',
  },
  {
    path: 'personalDetails.links.linkedin',
    fieldId: 'personal-details-linkedin',
  },
  {
    path: 'personalDetails.links.github',
    fieldId: 'personal-details-github',
  },
  {
    path: 'personalDetails.links.portfolio',
    fieldId: 'personal-details-portfolio',
  },
] as const;

const INPUT_CLASS =
  'w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-accent focus:outline-none';

function inputClass(hasError: boolean): string {
  return `${INPUT_CLASS} ${hasError ? 'border-red-300/80' : 'border-white/15'}`;
}

function now(): string {
  return new Date().toISOString();
}

function optionalValue(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} class="mt-2 text-sm font-medium text-red-200">
      {message}
    </p>
  );
}

export default function PersonalDetailsStep({
  draft,
  dispatch,
  onBack,
  onContinue,
  backLabel = 'Back',
  continueLabel = 'Continue',
}: PersonalDetailsStepProps) {
  const [hasAttemptedContinue, setHasAttemptedContinue] = useState(false);
  const validation = hasAttemptedContinue
    ? validateResumeDraft(draft)
    : undefined;
  const errors = validation?.errors;
  const personalDetails = draft.personalDetails;

  function updateLocation(changes: Partial<ResumeLocation>) {
    dispatch({
      type: 'personal-details/location-changed',
      changes,
      at: now(),
    });
  }

  function updateLink(changes: Partial<ProfessionalLinks>) {
    dispatch({
      type: 'personal-details/links-changed',
      changes,
      at: now(),
    });
  }

  function handleFullNameInput(event: TargetedEvent<HTMLInputElement>) {
    dispatch({
      type: 'personal-details/full-name-changed',
      fullName: event.currentTarget.value,
      at: now(),
    });
  }

  function handleEmailInput(event: TargetedEvent<HTMLInputElement>) {
    dispatch({
      type: 'personal-details/email-changed',
      email: event.currentTarget.value,
      at: now(),
    });
  }

  function handlePhoneInput(event: TargetedEvent<HTMLInputElement>) {
    dispatch({
      type: 'personal-details/phone-changed',
      phone: event.currentTarget.value,
      at: now(),
    });
  }

  function handleSubmit(
    event: TargetedEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    setHasAttemptedContinue(true);

    const result = validateResumeDraft(draft);
    const firstInvalidField = STEP_VALIDATION_FIELDS.find(
      ({ path }) => result.errors[path] !== undefined,
    );

    if (firstInvalidField) {
      requestAnimationFrame(() => {
        document.getElementById(firstInvalidField.fieldId)?.focus();
      });
      return;
    }

    onContinue();
  }

  return (
    <form
      class="glass rounded-3xl p-6 sm:p-8"
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby="personal-details-step-heading"
    >
      <p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
        Step 2 of 6
      </p>
      <h2
        id="personal-details-step-heading"
        tabIndex={-1}
        class="mb-3 font-serif text-2xl font-light tracking-tight text-white sm:text-3xl"
      >
        Personal details
      </h2>
      <p class="mb-8 max-w-xl text-sm leading-relaxed text-white/70">
        Add only the contact information an employer needs. We do not ask for
        sensitive or unnecessary personal details.
      </p>

      <div class="space-y-8">
        <div>
          <label
            for="personal-details-full-name"
            class="mb-2 block text-sm font-medium text-white"
          >
            Full name <span class="text-accent">(required)</span>
          </label>
          <input
            id="personal-details-full-name"
            type="text"
            autocomplete="name"
            value={personalDetails.fullName}
            onInput={handleFullNameInput}
            placeholder="Maya Patel"
            required
            aria-invalid={Boolean(errors?.['personalDetails.fullName'])}
            aria-describedby={
              errors?.['personalDetails.fullName']
                ? 'personal-details-full-name-error'
                : undefined
            }
            class={inputClass(Boolean(errors?.['personalDetails.fullName']))}
          />
          <FieldError
            id="personal-details-full-name-error"
            message={errors?.['personalDetails.fullName']}
          />
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              for="personal-details-email"
              class="mb-2 block text-sm font-medium text-white"
            >
              Email <span class="text-accent">(required)</span>
            </label>
            <input
              id="personal-details-email"
              type="email"
              autocomplete="email"
              inputMode="email"
              spellcheck={false}
              value={personalDetails.email}
              onInput={handleEmailInput}
              placeholder="maya@example.com"
              required
              aria-invalid={Boolean(errors?.['personalDetails.email'])}
              aria-describedby={
                errors?.['personalDetails.email']
                  ? 'personal-details-email-error'
                  : undefined
              }
              class={inputClass(Boolean(errors?.['personalDetails.email']))}
            />
            <FieldError
              id="personal-details-email-error"
              message={errors?.['personalDetails.email']}
            />
          </div>

          <div>
            <label
              for="personal-details-phone"
              class="mb-2 block text-sm font-medium text-white"
            >
              Phone <span class="text-accent">(required)</span>
            </label>
            <input
              id="personal-details-phone"
              type="tel"
              autocomplete="tel"
              inputMode="tel"
              value={personalDetails.phone}
              onInput={handlePhoneInput}
              placeholder="0412 345 678"
              required
              aria-invalid={Boolean(errors?.['personalDetails.phone'])}
              aria-describedby={
                errors?.['personalDetails.phone']
                  ? 'personal-details-phone-help personal-details-phone-error'
                  : 'personal-details-phone-help'
              }
              class={inputClass(Boolean(errors?.['personalDetails.phone']))}
            />
            <p
              id="personal-details-phone-help"
              class="mt-2 text-xs leading-relaxed text-white/60"
            >
              Australian and international formats are accepted.
            </p>
            <FieldError
              id="personal-details-phone-error"
              message={errors?.['personalDetails.phone']}
            />
          </div>
        </div>

        <fieldset class="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <legend class="px-2 text-sm font-medium text-white">
            Location
          </legend>
          <p class="mb-5 text-xs leading-relaxed text-white/60">
            City-level location is enough. Do not enter a street address.
          </p>

          <div class="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                for="personal-details-city"
                class="mb-2 block text-sm font-medium text-white"
              >
                City <span class="text-accent">(required)</span>
              </label>
              <input
                id="personal-details-city"
                type="text"
                autocomplete="address-level2"
                value={personalDetails.location.city}
                onInput={(event) =>
                  updateLocation({ city: event.currentTarget.value })
                }
                placeholder="Sydney"
                required
                aria-invalid={Boolean(
                  errors?.['personalDetails.location.city'],
                )}
                aria-describedby={
                  errors?.['personalDetails.location.city']
                    ? 'personal-details-city-error'
                    : undefined
                }
                class={inputClass(
                  Boolean(errors?.['personalDetails.location.city']),
                )}
              />
              <FieldError
                id="personal-details-city-error"
                message={errors?.['personalDetails.location.city']}
              />
            </div>

            <div>
              <label
                for="personal-details-suburb"
                class="mb-2 block text-sm font-medium text-white"
              >
                Suburb <span class="text-white/55">(optional)</span>
              </label>
              <input
                id="personal-details-suburb"
                type="text"
                autocomplete="address-level3"
                value={personalDetails.location.suburb ?? ''}
                onInput={(event) =>
                  updateLocation({
                    suburb: optionalValue(event.currentTarget.value),
                  })
                }
                placeholder="Parramatta"
                class={inputClass(false)}
              />
            </div>

            <div>
              <label
                for="personal-details-state"
                class="mb-2 block text-sm font-medium text-white"
              >
                State or territory{' '}
                <span class="text-white/55">(optional)</span>
              </label>
              <select
                id="personal-details-state"
                autocomplete="address-level1"
                value={personalDetails.location.stateOrTerritory ?? ''}
                onChange={(event) =>
                  updateLocation({
                    stateOrTerritory:
                      event.currentTarget.value === ''
                        ? undefined
                        : (event.currentTarget
                            .value as AustralianStateOrTerritory),
                  })
                }
                class={inputClass(false)}
              >
                <option value="">Select a state</option>
                {AUSTRALIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                for="personal-details-postcode"
                class="mb-2 block text-sm font-medium text-white"
              >
                Postcode <span class="text-white/55">(optional)</span>
              </label>
              <input
                id="personal-details-postcode"
                type="text"
                autocomplete="postal-code"
                inputMode="numeric"
                value={personalDetails.location.postcode ?? ''}
                onInput={(event) =>
                  updateLocation({
                    postcode: optionalValue(event.currentTarget.value),
                  })
                }
                placeholder="2000"
                class={inputClass(false)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset class="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <legend class="px-2 text-sm font-medium text-white">
            Professional links <span class="text-white/55">(optional)</span>
          </legend>
          <p class="mb-5 text-xs leading-relaxed text-white/60">
            Add only links that strengthen your application. Use complete URLs
            beginning with http:// or https://.
          </p>

          <div class="space-y-5">
            <div>
              <label
                for="personal-details-linkedin"
                class="mb-2 block text-sm font-medium text-white"
              >
                LinkedIn
              </label>
              <input
                id="personal-details-linkedin"
                type="url"
                autocomplete="url"
                inputMode="url"
                spellcheck={false}
                value={personalDetails.links.linkedin ?? ''}
                onInput={(event) =>
                  updateLink({
                    linkedin: optionalValue(event.currentTarget.value),
                  })
                }
                placeholder="https://www.linkedin.com/in/maya-patel"
                aria-invalid={Boolean(
                  errors?.['personalDetails.links.linkedin'],
                )}
                aria-describedby={
                  errors?.['personalDetails.links.linkedin']
                    ? 'personal-details-linkedin-error'
                    : undefined
                }
                class={inputClass(
                  Boolean(errors?.['personalDetails.links.linkedin']),
                )}
              />
              <FieldError
                id="personal-details-linkedin-error"
                message={errors?.['personalDetails.links.linkedin']}
              />
            </div>

            <div>
              <label
                for="personal-details-github"
                class="mb-2 block text-sm font-medium text-white"
              >
                GitHub
              </label>
              <input
                id="personal-details-github"
                type="url"
                autocomplete="url"
                inputMode="url"
                spellcheck={false}
                value={personalDetails.links.github ?? ''}
                onInput={(event) =>
                  updateLink({
                    github: optionalValue(event.currentTarget.value),
                  })
                }
                placeholder="https://github.com/maya-patel"
                aria-invalid={Boolean(
                  errors?.['personalDetails.links.github'],
                )}
                aria-describedby={
                  errors?.['personalDetails.links.github']
                    ? 'personal-details-github-error'
                    : undefined
                }
                class={inputClass(
                  Boolean(errors?.['personalDetails.links.github']),
                )}
              />
              <FieldError
                id="personal-details-github-error"
                message={errors?.['personalDetails.links.github']}
              />
            </div>

            <div>
              <label
                for="personal-details-portfolio"
                class="mb-2 block text-sm font-medium text-white"
              >
                Portfolio
              </label>
              <input
                id="personal-details-portfolio"
                type="url"
                autocomplete="url"
                inputMode="url"
                spellcheck={false}
                value={personalDetails.links.portfolio ?? ''}
                onInput={(event) =>
                  updateLink({
                    portfolio: optionalValue(event.currentTarget.value),
                  })
                }
                placeholder="https://mayapatel.com"
                aria-invalid={Boolean(
                  errors?.['personalDetails.links.portfolio'],
                )}
                aria-describedby={
                  errors?.['personalDetails.links.portfolio']
                    ? 'personal-details-portfolio-error'
                    : undefined
                }
                class={inputClass(
                  Boolean(errors?.['personalDetails.links.portfolio']),
                )}
              />
              <FieldError
                id="personal-details-portfolio-error"
                message={errors?.['personalDetails.links.portfolio']}
              />
            </div>
          </div>
        </fieldset>
      </div>

      <div class="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          class="rounded-full border border-white/20 px-7 py-3 text-sm font-bold text-white transition hover:border-white/40"
        >
          {backLabel}
        </button>
        <button
          type="submit"
          class="rounded-full bg-accent px-7 py-3 text-sm font-bold text-ink transition hover:brightness-105"
        >
          {continueLabel}
        </button>
      </div>
    </form>
  );
}

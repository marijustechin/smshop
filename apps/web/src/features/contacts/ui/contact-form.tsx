'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { FormField } from '@/shared/ui/form-field';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { TurnstileWidget, useTurnstileGate } from '@/shared/ui/turnstile';
import { cn } from '@/shared/lib/cn';
import { submitContactForm } from '../api/contact-form-api';
import { CONTACT_TOPIC_LABELS, CONTACT_TOPIC_VALUES, type ContactTopic } from '../model/topics';

const MESSAGE_MAX = 5000;
const NAME_MAX = 100;
const PHONE_MAX = 50;

const TURNSTILE_ERROR = 'Nepavyko patvirtinti, kad nesate robotas. Bandykite dar kartą.';

const schema = z.object({
  topic: z
    .string()
    .min(1, 'Pasirinkite temą')
    .refine((value) => (CONTACT_TOPIC_VALUES as readonly string[]).includes(value), {
      message: 'Pasirinkite temą',
    }),
  email: z
    .string()
    .trim()
    .min(1, 'Įveskite el. paštą')
    .max(254)
    .pipe(z.email('Neteisingas el. pašto formatas')),
  message: z
    .string()
    .trim()
    .min(1, 'Įveskite žinutę')
    .max(MESSAGE_MAX, `Žinutė negali viršyti ${MESSAGE_MAX} simbolių`),
  name: z.string().trim().max(NAME_MAX, `Vardas negali viršyti ${NAME_MAX} simbolių`).optional(),
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX, `Telefonas negali viršyti ${PHONE_MAX} simbolių`)
    .optional(),
});

type FormValues = z.infer<typeof schema>;

/** Maps a submission failure to a concise Lithuanian message (no internals). */
function mapContactError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return 'Per daug bandymų. Palaukite ir bandykite dar kartą.';
    }
    if (error.status === 403) {
      return TURNSTILE_ERROR;
    }
    if (error.status === 400) {
      return 'Patikrinkite pateiktus duomenis.';
    }
    if (error.status === 0) {
      return 'Nepavyko susisiekti. Patikrinkite ryšį ir bandykite dar kartą.';
    }
    if (error.status >= 500) {
      return 'Nepavyko išsiųsti žinutės. Bandykite vėliau.';
    }
  }
  return 'Įvyko netikėta klaida. Bandykite dar kartą.';
}

const controlClass =
  'flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus aria-[invalid=true]:border-danger-border';

/**
 * Public contact form (SITE-004). Sends through the server endpoint, which routes
 * to the administrator-managed contact group for the selected topic. Values are
 * preserved on failure and cleared only after a successful submission. The
 * single-use Turnstile token is consumed before sending and re-acquired for a
 * retry.
 */
export function ContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { topic: '', email: '', message: '', name: '', phone: '' },
  });

  const [formError, setFormError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const turnstile = useTurnstileGate({
    onTokenAvailable: () =>
      setFormError((current) => (current === TURNSTILE_ERROR ? null : current)),
  });

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(false);
    setFormError(null);
    // Turnstile tokens are single-use: consume before the request so a token the
    // server may have consumed is never resubmitted; the widget immediately
    // starts acquiring a fresh token for any retry.
    const turnstileToken = turnstile.token;
    turnstile.reset();
    try {
      await submitContactForm({
        topic: values.topic as ContactTopic,
        email: values.email.trim(),
        message: values.message.trim(),
        name: values.name?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        turnstileToken,
      });
      reset();
      setSuccess(true);
    } catch (error) {
      setFormError(mapContactError(error));
    }
  });

  return (
    <section aria-labelledby="contact-form-heading" className="scroll-mt-24">
      <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 space-y-1">
          <h2 id="contact-form-heading" className="text-2xl font-semibold text-primary">
            Parašykite mums
          </h2>
          <p className="text-sm text-text-muted">
            Užpildykite formą — atsakysime jūsų nurodytu el. paštu.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {success ? <Alert variant="success">Ačiū! Jūsų žinutė išsiųsta.</Alert> : null}
          {formError ? <Alert variant="error">{formError}</Alert> : null}

          <div className="space-y-1.5">
            <Label htmlFor="contact-topic">Tema</Label>
            <select
              id="contact-topic"
              aria-invalid={errors.topic ? true : undefined}
              aria-describedby={errors.topic ? 'contact-topic-error' : undefined}
              className={cn(controlClass, errors.topic && 'border-danger-border')}
              {...register('topic')}
            >
              <option value="">Pasirinkite temą</option>
              {CONTACT_TOPIC_VALUES.map((topic) => (
                <option key={topic} value={topic}>
                  {CONTACT_TOPIC_LABELS[topic]}
                </option>
              ))}
            </select>
            {errors.topic ? (
              <p id="contact-topic-error" className="text-xs text-danger">
                {errors.topic.message}
              </p>
            ) : null}
          </div>

          <FormField
            id="contact-email"
            label="El. paštas"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="space-y-1.5">
            <Label htmlFor="contact-message">Žinutė</Label>
            <Textarea
              id="contact-message"
              rows={6}
              maxLength={MESSAGE_MAX}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={errors.message ? 'contact-message-error' : undefined}
              {...register('message')}
            />
            {errors.message ? (
              <p id="contact-message-error" className="text-xs text-danger">
                {errors.message.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="contact-name"
              label="Vardas (nebūtina)"
              autoComplete="name"
              maxLength={NAME_MAX}
              error={errors.name?.message}
              {...register('name')}
            />
            <FormField
              id="contact-phone"
              label="Telefonas (nebūtinas)"
              type="tel"
              autoComplete="tel"
              maxLength={PHONE_MAX}
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>

          <TurnstileWidget key={turnstile.nonce} onTokenChange={turnstile.setToken} />

          <Button type="submit" disabled={isSubmitting || !turnstile.canSubmit}>
            {isSubmitting ? 'Siunčiama…' : 'Siųsti žinutę'}
          </Button>
        </form>
      </div>
    </section>
  );
}

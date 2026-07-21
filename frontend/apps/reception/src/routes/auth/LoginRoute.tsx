import { zodResolver } from '@hookform/resolvers/zod';
import { AppError } from '@masar/api-client';
import { signInWithPhone } from '@masar/auth';
import { Button, Card, CenteredLayout, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

/**
 * Teacher sign-in — phone + password (BACKEND_ARCHITECTURE.md §10.2).
 *
 * Tenant-side roles use a phone identity; MFA is mandatory for platform_admin
 * only, so there is no second factor here.
 *
 * No credential is created here: teacher accounts are provisioned by a manager
 * and activated through a one-time link sent to the teacher's own phone
 * (§10.3) — a manager never relays a password.
 */

const schema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{7,14}$/, 'Enter your phone in international format, e.g. +201001234567'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export function LoginRoute({
  onForgotPassword,
  onActivate,
}: {
  onForgotPassword: () => void;
  onActivate: () => void;
}) {
  const { locale } = useLocale();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signInWithPhone(values.phone, values.password);
    } catch (error) {
      setSubmitError(
        error instanceof AppError ? error.localized(locale) : 'Sign-in failed. Please try again.',
      );
    }
  });

  return (
    <CenteredLayout maxWidth={380}>
      <Card padding="lg">
        <form onSubmit={onSubmit} noValidate style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-extra)',
                color: 'var(--text-strong)',
              }}
            >
              Masar Reception
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Sign in with your staff phone number.
            </p>
          </div>

          <Input
            label="Phone"
            type="tel"
            autoComplete="username"
            inputMode="tel"
            dir="ltr"
            placeholder="+201001234567"
            {...register('phone')}
            {...(errors.phone?.message ? { error: errors.phone.message } : {})}
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            {...register('password')}
            {...(errors.password?.message ? { error: errors.password.message } : {})}
          />

          {submitError ? (
            <div
              role="alert"
              style={{
                background: 'var(--danger-50)',
                color: 'var(--danger-700)',
                border: '1px solid var(--danger-500)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {submitError}
            </div>
          ) : null}

          <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <div style={{ display: 'grid', gap: 'var(--space-1)', justifyItems: 'start' }}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onForgotPassword}
              style={{ minHeight: 44 }}
            >
              Forgot your password?
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onActivate} style={{ minHeight: 44 }}>
              First time here? Activate your account
            </Button>
          </div>
        </form>
      </Card>
    </CenteredLayout>
  );
}

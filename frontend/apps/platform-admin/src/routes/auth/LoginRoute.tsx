import { zodResolver } from '@hookform/resolvers/zod';
import { AppError } from '@masar/api-client';
import { signInWithEmail } from '@masar/auth';
import { Button, Card, CenteredLayout, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

/**
 * Platform Admin sign-in — email + password (BACKEND_ARCHITECTURE.md §10.2).
 * MFA is mandatory for this role and is handled immediately after by the auth
 * gate, not here (§28).
 *
 * No credential is ever created here. Accounts are invite-only and activated
 * through a one-time link (§10.3); this screen only authenticates an existing
 * identity.
 */

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export function LoginRoute({ onForgotPassword }: { onForgotPassword: () => void }) {
  const { locale } = useLocale();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signInWithEmail(values.email, values.password);
      // The auth gate re-renders on the session change and routes onward
      // (MFA enrolment / challenge / console).
    } catch (error) {
      setSubmitError(
        error instanceof AppError ? error.localized(locale) : 'Sign-in failed. Please try again.',
      );
    }
  });

  return (
    <CenteredLayout>
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
              Masar Platform Admin
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Sign in with your Platform Admin email. Two-factor authentication is required.
            </p>
          </div>

          <Input
            label="Email"
            type="email"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            {...register('email')}
            {...(errors.email?.message ? { error: errors.email.message } : {})}
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

          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onForgotPassword}
            style={{ minHeight: 44, justifySelf: 'start' }}
          >
            Forgot your password?
          </Button>
        </form>
      </Card>
    </CenteredLayout>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { AppError } from '@masar/api-client';
import { Button, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthAlert } from './authShell';
import { passwordSchema, type PasswordFormValues } from './password';

/**
 * Password creation, shared by activation and reset.
 *
 * Both flows end identically: an authenticated (short-lived) session exists and
 * the account sets its own password. `completeActivation` and `setPassword` are
 * the same `auth.updateUser({ password })` call under two names, kept distinct
 * in the auth package because they mean different things at the call site.
 *
 * The password is never transported anywhere else and is never shown to a
 * manager (§10.3).
 */
export function SetPasswordForm({
  submitLabel,
  pendingLabel,
  onSubmit,
  onDone,
}: {
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (password: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const { locale } = useLocale();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await onSubmit(values.password);
      onDone();
    } catch (err) {
      setError(
        err instanceof AppError ? err.localized(locale) : 'Could not set the password. Please try again.',
      );
    }
  });

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        dir="ltr"
        {...register('password')}
        {...(errors.password?.message ? { error: errors.password.message } : {})}
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        dir="ltr"
        {...register('confirm')}
        {...(errors.confirm?.message ? { error: errors.confirm.message } : {})}
      />

      {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

      <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
        {isSubmitting ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

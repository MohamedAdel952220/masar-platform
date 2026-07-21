import { z } from 'zod';

/**
 * Password rules for account activation and reset.
 *
 * Deliberately mirrors Supabase Auth's own minimum (8 characters) rather than
 * inventing a stricter local policy: the server is the authority on what it
 * will accept, and a client rule the server does not share produces a form that
 * rejects passwords the platform would have allowed.
 *
 * The confirmation field is a UX affordance only — it is never transported.
 */
export const PASSWORD_MIN = 8;

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, 'Use at least ' + PASSWORD_MIN + ' characters')
      .max(72, 'Passwords cannot be longer than 72 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Both passwords must match',
  });

export type PasswordFormValues = z.infer<typeof passwordSchema>;

/** International phone format, matching the existing sign-in screens. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, 'Enter your phone in international format, e.g. +201001234567');

/** Supabase phone OTPs are 6 digits. */
export const otpSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, 'Enter the 6-digit code');

export { AuthProvider, useAuth, type AuthContextValue, type AuthStatus } from './AuthProvider';

export {
  readClaims,
  canOpenPortal,
  isPlatformAdminManagerTier,
  EMPTY_CLAIMS,
  type MasarClaims,
} from './claims';

export {
  RequireAuth,
  RequirePortal,
  RequireRole,
  type GuardProps,
  type RequirePortalProps,
  type RequireRoleProps,
} from './guards';

export {
  signInWithPhone,
  signInWithEmail,
  signOut,
  restoreSession,
  refreshSession,
  completeActivation,
  requestPhonePasswordReset,
  requestEmailPasswordReset,
  verifyPhoneOtp,
  setPassword,
  type SignInResult,
} from './flows';

export {
  getMfaStatus,
  enrollTotp,
  verifyTotpEnrollment,
  challengeTotp,
  listTotpFactors,
  unenrollTotp,
  type AssuranceLevel,
  type MfaEnrollment,
  type MfaStatus,
} from './mfa';

/* ============================================================================
   Masar — Epic 1 backend integration client (LIVE — Integration Validation)
   ============================================================================
   Loaded by every portal's index.html as of Integration Validation (see
   EPIC_1_INTEGRATION_REPORT.md). Exposes window.MasarClient, following the
   same window.* global convention every other shared module here uses
   (masar-ui.jsx, DForms, etc.) — no bundler, no build step, matching the
   rest of this static/Babel-in-browser prototype.

   Scope is exactly Epic 1's deployed API surface: Supabase Auth sign-in, and
   the five Epic 1 Edge Functions (provision-tenant, suspend-staff-account,
   reactivate-staff-account, revoke-sessions, regenerate-activation-link).
   Nothing here calls, assumes, or depends on any Epic 2+ table or function.

   Loaded after: https://esm.sh/@supabase/supabase-js@2 and env.epic1.js
   (which sets window.__MASAR_ENV__ to the public-safe project URL/anon key).
   ========================================================================= */

(function () {
  'use strict';

  function getConfig() {
    // Values are expected to be injected by the hosting environment (e.g. a
    // small inline <script> before this one setting window.__MASAR_ENV__),
    // never hardcoded here — this file ships identically to every environment.
    var env = window.__MASAR_ENV__ || {};
    return {
      url: env.SUPABASE_URL || '',
      anonKey: env.SUPABASE_ANON_KEY || '',
    };
  }

  function client() {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('supabase-js is not loaded. Include https://esm.sh/@supabase/supabase-js@2 before this file.');
    }
    var cfg = getConfig();
    if (!cfg.url || !cfg.anonKey) {
      throw new Error('window.__MASAR_ENV__.SUPABASE_URL / SUPABASE_ANON_KEY are not configured.');
    }
    if (!window.__masarSupabaseSingleton__) {
      window.__masarSupabaseSingleton__ = window.supabase.createClient(cfg.url, cfg.anonKey);
    }
    return window.__masarSupabaseSingleton__;
  }

  // ---- Auth (Epic 1 scope: phone+password sign-in for tenant-side roles,
  // email+password for Platform Admin, matching §10.2) -----------------------
  async function signInWithPhone(phone, password) {
    var supa = client();
    var res = await supa.auth.signInWithPassword({ phone: phone, password: password });
    if (res.error) throw res.error;
    return res.data;
  }

  async function signInPlatformAdmin(email, password) {
    var supa = client();
    var res = await supa.auth.signInWithPassword({ email: email, password: password });
    if (res.error) throw res.error;
    return res.data;
  }

  async function signOut() {
    var supa = client();
    await supa.auth.signOut();
  }

  // Platform Admin "forgot password" — Supabase's own transactional email,
  // a real (non-stubbed) mechanism today, unlike the WhatsApp/SMS activation
  // link in _shared/activation.ts which is intentionally stubbed until Epic 4.
  async function resetPasswordForEmail(email) {
    var supa = client();
    var res = await supa.auth.resetPasswordForEmail(email);
    if (res.error) throw res.error;
    return res.data;
  }

  // Tenant-side "forgot password" — phone OTP. The call itself is real and
  // wired correctly; delivery depends on an SMS provider being configured on
  // the project (config.toml has [auth.sms.twilio] enabled = false by
  // default in Epic 1), so this may not arrive until that's turned on. See
  // EPIC_1_INTEGRATION_REPORT.md for the exact current state.
  async function sendPhoneOtp(phone) {
    var supa = client();
    var res = await supa.auth.signInWithOtp({ phone: phone });
    if (res.error) throw res.error;
    return res.data;
  }

  async function verifyPhoneOtp(phone, token) {
    var supa = client();
    var res = await supa.auth.verifyOtp({ phone: phone, token: token, type: 'sms' });
    if (res.error) throw res.error;
    return res.data;
  }

  // Bilingual error extraction — Edge Functions always return
  // { error: { code, message_en, message_ar } } (§25.1/§25.2). Auth errors
  // from supabase-js itself don't have this shape, so we fall back to a
  // generic bilingual message rather than showing a raw English-only string
  // in an Arabic UI context.
  function getErrorMessage(err, lang) {
    var ar = lang === 'ar';
    var body = err && err.context && err.context.body;
    if (body && body.error && (body.error.message_en || body.error.message_ar)) {
      return ar ? (body.error.message_ar || body.error.message_en) : (body.error.message_en || body.error.message_ar);
    }
    if (err && err.message) {
      // Raw Supabase Auth error (e.g. "Invalid login credentials") — no
      // bilingual pair available from the SDK itself.
      return ar ? 'بيانات الدخول غير صحيحة أو حدث خطأ. حاول مرة أخرى.' : err.message;
    }
    return ar ? 'حدث خطأ غير متوقع.' : 'An unexpected error occurred.';
  }

  // ---- Edge Function calls (Epic 1 API surface, §14.2) ----------------------
  async function invokeEdgeFunction(name, body, idempotencyKey) {
    var supa = client();
    var headers = {};
    if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
    var res = await supa.functions.invoke(name, { body: body, headers: headers });
    if (res.error) throw res.error;
    return res.data;
  }

  function provisionTenant(payload) {
    return invokeEdgeFunction('provision-tenant', payload, crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  }
  function suspendStaffAccount(staffId, reason) {
    return invokeEdgeFunction('suspend-staff-account', { staffId: staffId, reason: reason });
  }
  function reactivateStaffAccount(staffId) {
    return invokeEdgeFunction('reactivate-staff-account', { staffId: staffId });
  }
  function revokeSessions(userId) {
    return invokeEdgeFunction('revoke-sessions', { userId: userId });
  }
  function regenerateActivationLink(userId) {
    return invokeEdgeFunction('regenerate-activation-link', { userId: userId });
  }

  window.MasarClient = {
    client: client,
    auth: {
      signInWithPhone: signInWithPhone,
      signInPlatformAdmin: signInPlatformAdmin,
      signOut: signOut,
      resetPasswordForEmail: resetPasswordForEmail,
      sendPhoneOtp: sendPhoneOtp,
      verifyPhoneOtp: verifyPhoneOtp,
    },
    getErrorMessage: getErrorMessage,
    provisionTenant: provisionTenant,
    suspendStaffAccount: suspendStaffAccount,
    reactivateStaffAccount: reactivateStaffAccount,
    revokeSessions: revokeSessions,
    regenerateActivationLink: regenerateActivationLink,
  };
})();

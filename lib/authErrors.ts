// Maps Supabase Auth (GoTrue) errors to clear, user-facing messages.
//
// SECURITY NOTE: Supabase intentionally returns the SAME `invalid_credentials`
// error for both a wrong password AND an unregistered email. This prevents
// account/email enumeration (an attacker probing which emails have accounts).
// We deliberately keep that case generic ("email or password is incorrect") and
// do NOT reveal whether the email exists. Only genuinely distinguishable,
// non-sensitive cases (unconfirmed email, rate limit, network) get a specific
// message.
//
// auth-js v2 sets `code` (string) and `status` (number) on AuthApiError; we map
// on those first and fall back to message-substring matching for older clients.

export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const status = (error as { status?: number })?.status;
  const rawMessage = (error as { message?: string })?.message;

  // A thrown Error with no code/status is usually a network/transport failure
  // (no response reached us), not an auth rejection.
  if (error instanceof Error && code === undefined && status === undefined) {
    const m = (rawMessage ?? '').toLowerCase();
    if (m.includes('network') || m.includes('fetch') || m.includes('timeout') || m.includes('connection')) {
      return "Can't reach the server. Please check your internet connection and try again.";
    }
  }

  switch (code) {
    case 'invalid_credentials':
      return 'The email or password you entered is incorrect. Please try again.';
    case 'email_not_confirmed':
      return 'Please confirm your email before signing in. Check your inbox for the verification link.';
    case 'user_banned':
      return 'This account has been suspended. Please contact support.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Please wait a moment and try again.';
  }

  if (status === 429) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Fallback for clients/versions that only populate `message`.
  if (rawMessage) {
    const m = rawMessage.toLowerCase();
    if (m.includes('invalid login credentials')) {
      return 'The email or password you entered is incorrect. Please try again.';
    }
    if (m.includes('email not confirmed')) {
      return 'Please confirm your email before signing in. Check your inbox for the verification link.';
    }
    return rawMessage;
  }

  return 'Something went wrong while signing in. Please try again.';
}

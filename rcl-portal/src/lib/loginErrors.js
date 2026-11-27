// Turns the stable login error codes (see server/auth/authorize.mjs) into messages. Client-safe.
export function loginErrorMessage(code) {
  const raw = String(code || '')
  if (raw.startsWith('rate_limited')) {
    const secs = Number(raw.split(':')[1]) || 300
    return `Too many failed attempts. Try again in about ${Math.max(1, Math.ceil(secs / 60))} minute(s).`
  }
  const messages = {
    invalid_credentials: 'Invalid username or password. Use your RMIS 2.0 username (not your email). If you have not set one up yet, complete onboarding on RMIS first.',
    club_terminated: "Your club is no longer active in RMIS.",
    member_inactive: 'Your RMIS account is inactive.',
    member_terminated: 'Your RMIS account has been terminated.',
    account_restricted: 'Your RMIS account is restricted.',
    no_access: 'Your RMIS role does not have access to the RCL portal.',
    rmis_unavailable: 'RMIS is not reachable right now. Please try again in a few minutes.',
    CredentialsSignin: 'Invalid username or password.',
  }
  return messages[raw] || 'Login failed. Please try again.'
}

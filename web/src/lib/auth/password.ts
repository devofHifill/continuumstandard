/**
 * Password rules, shared by the forms (instant feedback) and the mock backend
 * (the real check). The real API must enforce the same rules server-side.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`;

/** Returns an error message, or null if the password is acceptable. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return null;
}

/**
 * Only follow `next=` redirects to paths inside this app. Anything else
 * (`https://evil.test`, `//evil.test`, `javascript:`) is an *open redirect* risk.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

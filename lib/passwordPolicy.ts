
export const MAX_PASSWORD_LENGTH = 72;
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordRule = {
  /** Stable key, safe to use as a list key. */
  id: 'length' | 'lowercase' | 'uppercase' | 'number';
  /** User-facing label. Identical wording on every surface. */
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (p) => p.length >= MIN_PASSWORD_LENGTH,
  },
  { id: 'lowercase', label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number (0–9)', test: (p) => /\d/.test(p) },
];

/** Labels of the rules this password does NOT yet satisfy. Empty array = valid. */
export function getPasswordErrors(password: string): string[] {
  const errors = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`No more than ${MAX_PASSWORD_LENGTH} characters`);
  }

  return errors;
}

export function isPasswordValid(password: string): boolean {
  return getPasswordErrors(password).length === 0;
}

/**
 * Shared password strength validator.
 *
 * Requirements:
 *  - Minimum 8 characters
 *  - At least 1 uppercase letter (A–Z)
 *  - At least 1 lowercase letter (a–z)
 *  - At least 1 digit (0–9)
 *  - At least 1 special character (!@#$%^&*_#^()-+=)
 *
 * Apply via @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
 */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^()\-+=])[A-Za-z\d@$!%*?&_#^()\-+=]{8,}$/;

export const PASSWORD_REGEX_MESSAGE =
  'Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&_#^()-+=).';

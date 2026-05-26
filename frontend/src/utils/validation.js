/** Shared client-side validation (mirrors expected server rules). */

const CONTROL_CHARS = /[\x00-\x1F\x7F]/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COUNTRY_REGEX = /^[a-zA-ZÀ-ÿ\s'-]{0,50}$/;
const SEARCH_QUERY_REGEX = /^[a-zA-Z0-9_\s.-]{2,50}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

function hasControlChars(value) {
  return typeof value === 'string' && CONTROL_CHARS.test(value);
}

function invalidCharsMessage(fieldLabel) {
  return `${fieldLabel} contains invalid or unsupported characters.`;
}

export function validateUsername(username) {
  const trimmed = (username ?? '').trim();
  if (!trimmed) return 'Username is required.';
  if (hasControlChars(username)) return invalidCharsMessage('Username');
  if (trimmed.length < 3) return 'Username must be at least 3 characters.';
  if (trimmed.length > 20) return 'Username cannot exceed 20 characters.';
  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Username may only contain letters, numbers, and underscores (no spaces or symbols).';
  }
  return null;
}

export function validateEmail(email) {
  const trimmed = (email ?? '').trim();
  if (!trimmed) return 'Email is required.';
  if (hasControlChars(email)) return invalidCharsMessage('Email');
  if (trimmed.length > 254) return 'Email is too long.';
  if (!EMAIL_REGEX.test(trimmed)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password, { forRegister = false } = {}) {
  if (password == null || password === '') {
    return forRegister ? 'Password is required.' : 'Password is required.';
  }
  if (hasControlChars(password)) return invalidCharsMessage('Password');
  if (forRegister) {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      return `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`;
    }
    if (password !== password.trim()) {
      return 'Password cannot start or end with spaces.';
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return 'Password must include at least one letter and one number.';
    }
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateCountry(country) {
  const trimmed = (country ?? '').trim();
  if (!trimmed) return null;
  if (hasControlChars(country)) return invalidCharsMessage('Country');
  if (!COUNTRY_REGEX.test(trimmed)) {
    return 'Country may only contain letters, spaces, hyphens, and apostrophes.';
  }
  return null;
}

export function validateAvatarUrl(url) {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return null;
  if (hasControlChars(url)) return invalidCharsMessage('Avatar URL');
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Avatar URL must start with http:// or https://';
    }
  } catch {
    return 'Enter a valid URL (e.g. https://example.com/avatar.png).';
  }
  if (trimmed.length > 500) return 'Avatar URL is too long.';
  return null;
}

export function validateLoginIdentifier(identifier) {
  const trimmed = (identifier ?? '').trim();
  if (!trimmed) return 'Username or email is required.';
  if (hasControlChars(identifier)) return invalidCharsMessage('Identifier');
  if (trimmed.length > 254) return 'Identifier is too long.';
  return null;
}

export function validateSearchQuery(query) {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return 'Enter a search term.';
  if (hasControlChars(query)) return invalidCharsMessage('Search query');
  if (trimmed.length < 2) return 'Search must be at least 2 characters.';
  if (trimmed.length > 50) return 'Search cannot exceed 50 characters.';
  if (!SEARCH_QUERY_REGEX.test(trimmed)) {
    return 'Search may only contain letters, numbers, spaces, dots, hyphens, and underscores.';
  }
  return null;
}

export function validateRegisterForm({ nombre_usuario, correo, hash_contrasena, pais }) {
  const fieldErrors = {};
  const usernameErr = validateUsername(nombre_usuario);
  const emailErr = validateEmail(correo);
  const passwordErr = validatePassword(hash_contrasena, { forRegister: true });
  const countryErr = validateCountry(pais);

  if (usernameErr) fieldErrors.nombre_usuario = usernameErr;
  if (emailErr) fieldErrors.correo = emailErr;
  if (passwordErr) fieldErrors.hash_contrasena = passwordErr;
  if (countryErr) fieldErrors.pais = countryErr;

  return fieldErrors;
}

export function validateSettingsForm({ nombre_usuario, correo, url_avatar, pais }) {
  const fieldErrors = {};
  const usernameErr = validateUsername(nombre_usuario);
  const emailErr = validateEmail(correo);
  const avatarErr = validateAvatarUrl(url_avatar);
  const countryErr = validateCountry(pais);

  if (usernameErr) fieldErrors.nombre_usuario = usernameErr;
  if (emailErr) fieldErrors.correo = emailErr;
  if (avatarErr) fieldErrors.url_avatar = avatarErr;
  if (countryErr) fieldErrors.pais = countryErr;

  return fieldErrors;
}

export function validateLoginForm({ username, password }) {
  const fieldErrors = {};
  const idErr = validateLoginIdentifier(username);
  const passErr = validatePassword(password);

  if (idErr) fieldErrors.username = idErr;
  if (passErr) fieldErrors.password = passErr;

  return fieldErrors;
}

/** First error message from a fieldErrors map, or null. */
export function firstFieldError(fieldErrors) {
  const keys = Object.keys(fieldErrors);
  return keys.length ? fieldErrors[keys[0]] : null;
}

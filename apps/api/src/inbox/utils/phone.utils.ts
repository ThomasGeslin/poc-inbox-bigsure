import {
  parsePhoneNumberWithError,
  isValidPhoneNumber,
} from 'libphonenumber-js';

/**
 * Normalizes a phone number to E.164 format.
 * Handles:
 *   - Numbers already in E.164 (+33778902386)
 *   - Local format without country code (0778902386 → +33778902386)
 *   - International format with erroneous trunk prefix (+33 0778902386 → +33778902386)
 *
 * Returns the original string unchanged if normalization is not possible.
 */
export function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return phone;

  // Build candidates to try in order:
  // 1. The raw input
  // 2. Same input with the trunk-prefix 0 stripped after the country code
  //    (handles "+33 0778902386" → "+33778902386")
  const candidates: string[] = [phone];
  const trunkStripped = phone.replace(/^(\+\d{1,3})\s*0(\d)/, '$1$2');

  if (trunkStripped !== phone) candidates.push(trunkStripped);

  for (const candidate of candidates) {
    try {
      if (isValidPhoneNumber(candidate))
        return parsePhoneNumberWithError(candidate).format('E.164');

      const parsed = parsePhoneNumberWithError(candidate, 'FR');
      if (parsed.isValid()) return parsed.format('E.164');
    } catch {
      console.warn(`Failed to parse phone number: ${candidate}`);
    }
  }

  return phone;
}

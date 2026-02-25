/**
 * Maps raw error strings from Cloud Functions to i18n-friendly keys.
 * Returns a key under the `common` namespace, or the cleaned-up original string.
 */
export function formatError(raw: string | undefined, t: (key: string) => string): string {
  if (!raw) return t('unknownError');

  // Pattern → i18n key (under `common`)
  if (/503|UNAVAILABLE|high demand/i.test(raw)) return t('serverBusy');
  if (/429|RESOURCE_EXHAUSTED|rate/i.test(raw)) return t('rateLimited');
  if (/timed out/i.test(raw)) return t('timedOut');
  if (/Failed to generate/i.test(raw)) return t('generationFailed');

  // Strip JSON wrapper if the error is a raw JSON blob
  const jsonMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
  if (jsonMatch) return jsonMatch[1];

  return raw;
}

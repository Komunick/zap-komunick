// Zap Komunick P0: credential requests may contain replacement values even when
// validation fails. Keep those events out of remote error telemetry entirely.
export const isCredentialRequest = (url?: string): boolean => {
  if (!url) return false;
  // Express decodes route parameters independently of the query string. A bad
  // query escape must not hide a valid, encoded credential path from this guard.
  const path = url.split(/[?#]/, 1)[0];
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A malformed URL should not prevent the application from handling errors.
  }
  return (
    /\/credentials(?:[/?#]|$)/i.test(decoded) ||
    /\/settings\/(?:openAiKey|acessoriasApiToken|sciPartnerToken|sciClientToken)(?:[/?#]|$)/i.test(
      decoded
    )
  );
};

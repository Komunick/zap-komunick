// Zap Komunick P0: credential requests may contain replacement values even when
// validation fails. Keep those events out of remote error telemetry entirely.
export const isCredentialRequest = (url?: string): boolean => {
  if (!url) return false;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
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

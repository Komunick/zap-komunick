// Zap Komunick P0: credential requests may contain replacement values even when
// validation fails. Keep those events out of remote error telemetry entirely.
const decodedPath = (url?: string): string => {
  if (!url) return "";
  // Express decodes route parameters independently of the query string. A bad
  // query escape must not hide a valid, encoded credential path from this guard.
  const path = url.split(/[?#]/, 1)[0];
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A malformed URL should not prevent the application from handling errors.
  }
  return decoded;
};

export const isCredentialRequest = (url?: string): boolean => {
  const decoded = decodedPath(url);
  return (
    /\/credentials(?:[/?#]|$)/i.test(decoded) ||
    /\/settings\/(?:openAiKey|acessoriasApiToken|sciPartnerToken|sciClientToken)(?:[/?#]|$)/i.test(
      decoded
    )
  );
};

// P1: even rejected bodies may contain conversation data supplied by a caller.
export const isAssistantRequest = (url?: string): boolean =>
  /\/tickets\/[^/]+\/assistant(?:[/?#]|$)/i.test(decodedPath(url)) ||
  /\/settings\/aiAssistantEnabled(?:[/?#]|$)/i.test(decodedPath(url));

export const isSensitiveRequest = (url?: string): boolean =>
  isCredentialRequest(url) || isAssistantRequest(url);

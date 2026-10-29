// Zap Komunick P0: credential requests may contain replacement values even when
// validation fails. Keep those events out of remote error telemetry entirely.
const decodedPath = (url?: string): string => {
  if (!url) return "";
  // Express decodes route parameters independently of the query string. A bad
  // query escape must not hide a valid, encoded credential path from this guard.
  const path = url.split(/[?#]/, 1)[0];
  return path
    .split("/")
    .map(segment => {
      try {
        return decodeURIComponent(segment);
      } catch {
        // One invalid parameter must not hide a separately encoded sensitive endpoint.
        return segment;
      }
    })
    .join("/");
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
// Privacy classification tolerates separators inside a decoded ticket parameter.
// The router and authorization service retain responsibility for accepting IDs.
export const isAssistantRequest = (url?: string): boolean =>
  /\/tickets\/[\s\S]+\/assistant(?:[/?#]|$)/i.test(decodedPath(url)) ||
  /\/settings\/aiAssistantEnabled(?:[/?#]|$)/i.test(decodedPath(url));

export const isAcessoriasRequest = (url?: string): boolean =>
  /\/tickets\/[\s\S]+\/acessorias(?:[/?#]|$)/i.test(decodedPath(url)) ||
  /\/settings\/acessoriasEnabled(?:[/?#]|$)/i.test(decodedPath(url));

export const isSciRequest = (url?: string): boolean =>
  /\/tickets\/[\s\S]+\/sci(?:[/?#]|$)/i.test(decodedPath(url)) ||
  /\/settings\/sciEnabled(?:[/?#]|$)/i.test(decodedPath(url));

export const isAttachmentRequest = (url?: string): boolean =>
  /\/tickets\/[\s\S]+\/attachments(?:[/?#]|$)/i.test(decodedPath(url));

export const isSensitiveRequest = (url?: string): boolean =>
  isCredentialRequest(url) ||
  isAssistantRequest(url) ||
  isAcessoriasRequest(url) ||
  isSciRequest(url) ||
  isAttachmentRequest(url);

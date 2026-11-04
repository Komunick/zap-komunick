export interface ImpersonationClaims {
  id?: unknown;
  companyId?: unknown;
  profile?: unknown;
  super?: unknown;
  tokenVersion?: unknown;
  impersonated?: unknown;
  originalUserId?: unknown;
  originalCompanyId?: unknown;
  originalTokenVersion?: unknown;
}

export interface ImpersonationOrigin {
  originalUserId: number;
  originalCompanyId: number;
  originalTokenVersion: number;
}

export function positiveSessionId(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export function validTokenVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function impersonationOrigin(
  claims: ImpersonationClaims
): ImpersonationOrigin | undefined {
  const originalUserId = positiveSessionId(claims.originalUserId);
  const originalCompanyId = positiveSessionId(claims.originalCompanyId);
  if (
    claims.impersonated !== true ||
    !originalUserId ||
    !originalCompanyId ||
    !validTokenVersion(claims.originalTokenVersion)
  )
    return undefined;
  return {
    originalUserId,
    originalCompanyId,
    originalTokenVersion: claims.originalTokenVersion
  };
}

// Both signed credentials must describe the same identity and delegation.
export function sessionPairMatches(
  access: ImpersonationClaims,
  refresh: ImpersonationClaims
): boolean {
  const id = positiveSessionId(access.id);
  const companyId = positiveSessionId(access.companyId);
  const flags = [access.impersonated, refresh.impersonated];
  if (
    !id ||
    !companyId ||
    id !== positiveSessionId(refresh.id) ||
    companyId !== positiveSessionId(refresh.companyId) ||
    flags.some(flag => flag !== undefined && typeof flag !== "boolean") ||
    (access.impersonated === true) !== (refresh.impersonated === true)
  )
    return false;
  if (access.impersonated !== true) return true;
  const left = impersonationOrigin(access);
  const right = impersonationOrigin(refresh);
  return (
    !!left &&
    !!right &&
    left.originalUserId === right.originalUserId &&
    left.originalCompanyId === right.originalCompanyId &&
    left.originalTokenVersion === right.originalTokenVersion
  );
}

export function currentAccessMatches(
  access: ImpersonationClaims,
  user: { id: number; companyId: number; profile: string; super: boolean }
): boolean {
  return (
    user.id === positiveSessionId(access.id) &&
    user.companyId === positiveSessionId(access.companyId) &&
    user.profile === access.profile &&
    user.super === access.super
  );
}

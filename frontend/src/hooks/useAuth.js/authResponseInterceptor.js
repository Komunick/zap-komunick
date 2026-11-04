// Zap Komunick: authorization failures must never start a refresh loop.
export const isSignInRequest = config =>
  ["/auth/login", "/auth/2fa"].includes(config?.url);

const isSecondFactorValidationError = error =>
  error.config?.url?.startsWith("/security/2fa/") &&
  ["ERR_2FA_INVALID_CODE", "ERR_INVALID_CREDENTIALS"].includes(
    error.response?.data?.error
  );

export const registerAuthResponseInterceptor = (client, endSession) =>
  client.interceptors.response.use(
    response => response,
    async error => {
      const request = error.config;
      const status = error.response?.status;
      const code = error.response?.data?.error;
      if (isSignInRequest(request) || isSecondFactorValidationError(error)) {
        return Promise.reject(error);
      }

      // IP restrictions, access hours and revoked refresh tokens all end the
      // session here. The refresh endpoint must never retry itself.
      if (request?.url === "/auth/refresh_token") {
        if (status === 401 || status === 403) endSession();
        return Promise.reject(error);
      }

      if (
        status === 403 &&
        code === "ERR_SESSION_EXPIRED" &&
        request &&
        !request._retry
      ) {
        request._retry = true;
        const { data } = await client.post("/auth/refresh_token");
        if (data?.token) {
          localStorage.setItem("token", JSON.stringify(data.token));
          client.defaults.headers.Authorization = `Bearer ${data.token}`;
          request.headers.Authorization = `Bearer ${data.token}`;
        }
        return client(request);
      }

      if (
        status === 401 ||
        (status === 403 && code === "ERR_SESSION_EXPIRED" && request?._retry)
      ) {
        endSession();
      }
      return Promise.reject(error);
    }
  );

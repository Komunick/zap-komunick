import { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import { clearAllCachedSettings } from "../../helpers/settingsCache";
import moment from "moment";
import { decodeToken } from "react-jwt";
import { readStoredToken } from "../../helpers/storedToken";
import { getSessionHome } from "../../helpers/sessionHome";
import {
  isSignInRequest,
  registerAuthResponseInterceptor
} from "./authResponseInterceptor";

let apiInterceptorsRegistered = false;

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});
  const [authenticating, setAuthenticating] = useState(false);
  const signInRequest = useRef(null);
  const signInSequence = useRef(0);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    if (apiInterceptorsRegistered) {
      return;
    }
    apiInterceptorsRegistered = true;

    api.interceptors.request.use(
      config => {
        // Password and second-factor requests cannot restore another session.
        if (isSignInRequest(config)) {
          delete config.headers.Authorization;
          return config;
        }
        const token = readStoredToken();
        if (token) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );

    registerAuthResponseInterceptor(api, () => {
      clearAllCachedSettings();
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("companyId");
      api.defaults.headers.Authorization = undefined;
      setUser({});
      setIsAuth(false);
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    (async () => {
      if (token) {
        try {
          const { data } = await api.post("/auth/refresh_token");
          localStorage.setItem("token", JSON.stringify(data.token));
          api.defaults.headers.Authorization = `Bearer ${data.token}`;
          socketManager.syncCurrentSocketToken?.(data.token);
          setUser(data.user);
          setIsAuth(true);
        } catch (err) {
          setUser({});
          setIsAuth(false);
          toastError(err);
        }
      }
      setLoading(false);
    })();
  }, [socketManager]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId) {
      return () => {};
    }
    const socket = socketManager.GetSocket(companyId);

    const onCompanyUserUseAuth = data => {
      if (data.action === "update" && data.user.id === user.id) {
        setUser(data.user);
      }
    };

    socket.on(`company-${companyId}-user`, onCompanyUserUseAuth);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const posLogin = (data, impersonated = false) => {
    const {
      user: { company },
      token
    } = data;

    const { companyId } = decodeToken(token);

    if (has(company, "settings") && isArray(company.settings)) {
      const setting = company.settings.find(s => s.key === "campaignsEnabled");
      if (setting && setting.value === "true") {
        localStorage.setItem("cshow", null); //regra pra exibir campanhas
      }
    }

    moment.locale("pt-br");
    const dueDate = data.user.company.dueDate;
    const vencimento = moment(dueDate).format("DD/MM/yyyy");

    var diff = moment(dueDate).diff(moment(moment()).format());

    var dias = moment.duration(diff).asDays();

    clearAllCachedSettings();

    localStorage.setItem("token", JSON.stringify(token));
    localStorage.setItem("companyId", companyId);
    localStorage.setItem("userId", data.user.id);
    localStorage.setItem("companyDueDate", vencimento);
    localStorage.setItem("impersonated", impersonated);
    api.defaults.headers.Authorization = `Bearer ${data.token}`;
    setUser(data.user);
    setIsAuth(true);
    if (dias < 0) {
      toast.warn(
        `Sua assinatura venceu há ${Math.round(dias) * -1} ${Math.round(dias) * -1 === 1 ? "dia" : "dias"} `
      );
    } else if (Math.round(dias) < 5) {
      toast.warn(
        `Sua assinatura vence em ${Math.round(dias)} ${Math.round(dias) === 1 ? "dia" : "dias"} `
      );
    } else {
      toast.success(i18n.t("auth.toasts.success"));
    }
    history.push(getSessionHome(data.user));
  };

  // Zap Komunick: keep the password/challenge exchange separate from a
  // completed session. Only the final response reaches posLogin (RF-016).
  const cancelLogin = useCallback(() => {
    signInSequence.current += 1;
    signInRequest.current?.abort();
    signInRequest.current = null;
    setAuthenticating(false);
  }, []);

  const authenticate = async (url, payload) => {
    if (signInRequest.current) return { cancelled: true };
    const request = ++signInSequence.current;
    const controller = new AbortController();
    signInRequest.current = controller;
    setAuthenticating(true);
    try {
      const { data } = await api.post(url, payload, {
        signal: controller.signal
      });
      if (request !== signInSequence.current) return { cancelled: true };
      if (data.twoFactorRequired) {
        if (typeof data.challenge !== "string" || !data.challenge) {
          return { error: "ERR_2FA_CHALLENGE_EXPIRED" };
        }
        const expires = decodeToken(data.challenge)?.exp;
        return {
          twoFactorRequired: true,
          challenge: data.challenge,
          // The server validates expiry; this timestamp only guides the UI.
          expiresAt:
            typeof expires === "number"
              ? expires * 1000
              : Date.now() + 5 * 60 * 1000
        };
      }
      posLogin(data);
      return { authenticated: true };
    } catch (err) {
      if (controller.signal.aborted || request !== signInSequence.current) {
        return { cancelled: true };
      }
      return {
        error: err.response?.data?.error || "ERR_UNKNOWN",
        retryAfter: Number(err.response?.headers?.["retry-after"]) || 600
      };
    } finally {
      if (request === signInSequence.current) {
        signInRequest.current = null;
        setAuthenticating(false);
      }
    }
  };

  const handleLogin = async userData => {
    const result = await authenticate("/auth/login", userData);
    if (result.error) toastError(result.error);
    return result;
  };

  const handleVerifyTwoFactor = ({ challenge, code }) =>
    authenticate("/auth/2fa", { challenge, code });

  const handleImpersonate = async companyId => {
    setLoading(true);

    try {
      const { data } = await api.get(`/auth/impersonate/${companyId}`);
      posLogin(data, true);
      setLoading(false);
      window.location.reload(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);

    try {
      const impersonatedFlag = localStorage.getItem("impersonated") === "true";
      const token = localStorage.getItem("token");
      let impersonatedByToken = false;

      if (token) {
        try {
          const decoded = decodeToken(JSON.parse(token));
          impersonatedByToken = !!decoded?.impersonated;
        } catch (_) {
          impersonatedByToken = false;
        }
      }

      if (impersonatedFlag || impersonatedByToken) {
        const socket = socketManager.GetSocket();
        socket.logout();

        const { data } = await api.post("/auth/impersonate/back");
        localStorage.removeItem("impersonated");
        posLogin(data, false);
        setLoading(false);
        window.location.reload(false);
        return;
      }

      const socket = socketManager.GetSocket();
      socket.logout();

      await api.delete("/auth/logout");
      clearAllCachedSettings();
      setIsAuth(false);
      setUser({});
      localStorage.removeItem("token");
      localStorage.removeItem("companyId");
      localStorage.removeItem("userId");
      localStorage.removeItem("cshow");
      localStorage.removeItem("impersonated");
      api.defaults.headers.Authorization = undefined;

      setLoading(false);
      history.push("/login");
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const getCurrentUserInfo = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      return data;
    } catch (_) {
      return null;
    }
  }, []);

  return {
    isAuth,
    user,
    loading,
    authenticating,
    handleLogin,
    handleVerifyTwoFactor,
    cancelLogin,
    handleImpersonate,
    handleLogout,
    getCurrentUserInfo
  };
};

export default useAuth;

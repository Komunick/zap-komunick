import React, { createContext } from "react";

import useAuth from "../../hooks/useAuth.js";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const {
    loading,
    authenticating,
    user,
    isAuth,
    handleLogin,
    handleVerifyTwoFactor,
    cancelLogin,
    handleImpersonate,
    handleLogout
  } = useAuth();

  return (
    <AuthContext.Provider
      value={{
        loading,
        authenticating,
        user,
        isAuth,
        handleLogin,
        handleVerifyTwoFactor,
        cancelLogin,
        handleImpersonate,
        handleLogout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };

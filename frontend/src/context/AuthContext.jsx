import React, { createContext, useState, useContext, useEffect } from 'react';
import api, { login as loginApi, logout as logoutApi } from '../api/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const { data } = await api.get('/profile/me');
          setUser({ token, ...data }); 
        } catch (err) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  const login = async (credentials) => {
    const { data } = await loginApi(credentials);
    localStorage.setItem('token', data.access_token);
    setUser({ token: data.access_token });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    logoutApi();
  };

  const updateUser = (newUserData) => {
    setUser(prev => prev ? { ...prev, ...newUserData } : null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => useContext(AuthContext);

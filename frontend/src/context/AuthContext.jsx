import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import api, { login as loginApi, logout as logoutApi } from '../api/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [activeInviteNotification, setActiveInviteNotification] = useState(null);
  const seenInviteIds = useRef(new Set());

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

  useEffect(() => {
    if (!user) {
      setIncomingInvites([]);
      setActiveInviteNotification(null);
      seenInviteIds.current.clear();
      return;
    }

    const fetchInvites = async () => {
      try {
        const { data } = await api.get('/match/invite/pending');
        const list = data || [];
        setIncomingInvites(list);

        // Find if there is a new invite we haven't seen in this session
        const newInvite = list.find(invite => !seenInviteIds.current.has(invite.id));
        if (newInvite) {
          seenInviteIds.current.add(newInvite.id);
          setActiveInviteNotification(newInvite);
        }

        // Clean up seenInviteIds for invites that are no longer in the list
        const currentIds = new Set(list.map(inv => inv.id));
        for (let id of seenInviteIds.current) {
          if (!currentIds.has(id)) {
            seenInviteIds.current.delete(id);
          }
        }
      } catch (err) {
        console.error("Error polling pending challenges:", err);
      }
    };

    fetchInvites();
    const interval = setInterval(fetchInvites, 4000);
    return () => clearInterval(interval);
  }, [user]);

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
    <AuthContext.Provider value={{ 
      user, login, logout, loading, updateUser,
      incomingInvites, activeInviteNotification, setActiveInviteNotification
    }}>
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => useContext(AuthContext);


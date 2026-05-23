import { useState, useEffect } from 'react';
import api from '../api/axios';
import { AuthContext } from './authContextValue';

async function loadStoredUser(setUser) {
  const token = localStorage.getItem('token');
  if (!token) {
    setUser(null);
    return null;
  }
  try {
    const response = await api.get('/auth/me/');
    setUser(response.data.user);
    return response.data.user;
  } catch {
    localStorage.removeItem('token');
    setUser(null);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem('token')));
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')));

  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = await loadStoredUser(setUser);
      setHasToken(Boolean(localStorage.getItem('token')) && Boolean(storedUser));
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login/', { email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setHasToken(true);
    setUser(user);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register/', { name, email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setHasToken(true);
    setUser(user);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setHasToken(false);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout, loading, hasToken }}>{children}</AuthContext.Provider>;
}

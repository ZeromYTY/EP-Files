import { useState, useEffect } from 'react';
import api from '../api/axios';
import { AuthContext } from './authContextValue';

async function loadStoredUser(setUser) {
  try {
    const response = await api.get('/auth/me/');
    setUser(response.data.user);
  } catch {
    setUser(null);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      await loadStoredUser(setUser);
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login/', { email, password });
    const { user } = response.data;
    setUser(user);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register/', { name, email, password });
    const { user } = response.data;
    setUser(user);
    return response.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout/');
    } finally {
      setUser(null);
    }
  };

  const updateUser = (nextUser) => setUser(nextUser);

  return <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser }}>{children}</AuthContext.Provider>;
}

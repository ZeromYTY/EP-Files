import { useState, useEffect } from 'react';
import api from '../api/axios';
import { AuthContext } from './authContextValue';

async function loadStoredUser(setUser) {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const response = await api.get('/auth/me/');
    setUser(response.data.user);
  } catch {
    localStorage.removeItem('token');
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
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register/', { name, email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (nextUser) => setUser(nextUser);

  return <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser }}>{children}</AuthContext.Provider>;
}

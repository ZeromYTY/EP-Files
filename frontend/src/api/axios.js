import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isUnauthorized = error.response?.status === 401;
    const isBlocked =
      error.response?.data?.code === 'user_blocked' ||
      error.response?.data?.detail === 'Ваш аккаунт заблокирован администратором.';
    const requestUrl = error.config?.url || '';
    const isAuthRequest =
      requestUrl.includes('/auth/login/') ||
      requestUrl.includes('/auth/register/');

    if ((isUnauthorized || isBlocked) && !isAuthRequest) {
      localStorage.removeItem('token');
      if (isBlocked) {
        sessionStorage.setItem('auth_error', 'Ваш аккаунт заблокирован администратором.');
      }

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const uploadFileApi = (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post('/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      onProgress(percentCompleted);
    },
  });
};

export const downloadFileApi = async (fileId, fileName) => {
  const response = await api.get(`/files/${fileId}/download/`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const readTextFileApi = (fileId) => api.get(`/files/${fileId}/content/`);
export const saveTextFileApi = (fileId, content) => api.post(`/files/${fileId}/save/`, { content });

export default api;

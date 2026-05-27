import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

api.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrftoken');
  const unsafeMethod = !['get', 'head', 'options', 'trace'].includes(config.method?.toLowerCase());
  if (csrfToken && unsafeMethod) {
    config.headers['X-CSRFToken'] = decodeURIComponent(csrfToken);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isUnauthorized = error.response?.status === 401;
    const isBlocked =
      error.response?.data?.code === 'user_blocked' ||
      error.response?.data?.detail === 'Ваш аккаунт заблокирован администратором.';
    const requestUrl = error.config?.url || '';
    const isAuthRequest =
      requestUrl.includes('/auth/login/') ||
      requestUrl.includes('/auth/register/');
    const isAuthCheckRequest = requestUrl.includes('/auth/me/');
    const isRefreshRequest = requestUrl.includes('/auth/refresh/');

    if (isUnauthorized && !isAuthRequest && !isRefreshRequest && !error.config?._retry) {
      error.config._retry = true;
      try {
        await api.post('/auth/refresh/');
        return api(error.config);
      } catch (refreshError) {
        if (refreshError.response?.data?.code === 'user_blocked') {
          sessionStorage.setItem('auth_error', 'Ваш аккаунт заблокирован администратором.');
        }
      }
    }

    if ((isBlocked || (isUnauthorized && !isAuthCheckRequest && !isRefreshRequest)) && !isAuthRequest) {
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

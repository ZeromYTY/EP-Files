import React, { useState, useEffect } from 'react';
import api from './api/axios';

const getPreviewType = (fileName) => {
  const extension = fileName?.split('.')?.pop()?.toLowerCase() || '';
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];
  const textExtensions = ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'xml', 'csv', 'log', 'py', 'java', 'c', 'cpp', 'sh'];

  if (imageExtensions.includes(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  if (textExtensions.includes(extension)) return 'text';
  return 'unsupported';
};

export default function FilePreviewModal({ file, onClose }) {
  const [content, setContent] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      setContent('');
      setPreviewUrl(null);

      const previewType = getPreviewType(file.name);
      if (previewType === 'unsupported') {
        setError(`Предпросмотр недоступен для файла ${file.name}`);
        setLoading(false);
        return;
      }

      try {
        const normalizedDownloadPath = file.download_url
          ? file.download_url.replace(/^\/api/, '')
          : `/files/${file.id}/download/`;

        if (previewType === 'text') {
          const response = await api.get(normalizedDownloadPath, { responseType: 'text' });
          if (cancelled) return;
          setContent(response.data);
        } else {
          const response = await api.get(normalizedDownloadPath, { responseType: 'blob' });
          if (cancelled) return;
          objectUrl = URL.createObjectURL(response.data);
          setPreviewUrl(objectUrl);
        }
      } catch (err) {
        console.error('Ошибка загрузки предпросмотра файла:', err);
        setError(err.response?.data?.detail || err.message || 'Не удалось загрузить файл для предпросмотра');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Block background scrolling while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)',
    zIndex: 2000,
    padding: 16,
  };

  const modalStyle = {
    background: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    width: 'min(95vw, 920px)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #eef2f7',
    background: '#fafafa',
  };

  const contentStyle = {
    flex: 1,
    overflow: 'auto',
    background: '#f7fafc',
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const preStyle = {
    width: '100%',
    maxHeight: '70vh',
    overflow: 'auto',
    background: '#ffffff',
    padding: 16,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace',
    fontSize: 13,
    color: '#374151',
    whiteSpace: 'pre-wrap',
    boxSizing: 'border-box',
  };

  const imgStyle = {
    maxWidth: '100%',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: 8,
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)'
  };

  const footerStyle = {
    padding: 12,
    borderTop: '1px solid #eef2f7',
    background: '#fafafa',
    display: 'flex',
    justifyContent: 'flex-end',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={headerStyle}>
          <div>
            <div style={{ fontWeight: 700, color: '#111827' }}>{file.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{getPreviewType(file.name)} • {(Number(file.size) / 1024).toFixed(1)} KB</div>
          </div>
          <button onClick={onClose} aria-label="Закрыть" style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        <div style={contentStyle}>
          {loading ? (
            <div style={{ color: '#9ca3af' }}>Загрузка данных...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 16, background: '#fff1f2', borderRadius: 8, border: '1px solid #fee2e2' }}>
              <div style={{ color: '#b91c1c', fontWeight: 600 }}>⚠️ Ошибка предпросмотра</div>
              <div style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</div>
            </div>
          ) : (
            <>
              {getPreviewType(file.name) === 'image' && previewUrl ? (
                <img src={previewUrl} alt="Preview" style={imgStyle} />
              ) : getPreviewType(file.name) === 'pdf' && previewUrl ? (
                <object data={previewUrl} type="application/pdf" style={{ width: '100%', height: '70vh' }}>
                  <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    Не удалось отобразить PDF. <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Открыть в новой вкладке</a>
                  </div>
                </object>
              ) : (
                <pre style={preStyle}>{content}</pre>
              )}
            </>
          )}
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer', color: '#374151' }}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

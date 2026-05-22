import { useEffect, useState } from 'react';
import api from './api/axios';

const previewGroups = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'],
  video: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mpeg', 'mpg', 'avi'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'],
  text: ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'xml', 'csv', 'log', 'py', 'java', 'c', 'cpp', 'sh'],
};

function getPreviewType(fileName) {
  const extension = fileName?.split('.')?.pop()?.toLowerCase() || '';
  if (extension === 'pdf') return 'pdf';
  return Object.entries(previewGroups).find(([, extensions]) => extensions.includes(extension))?.[0] || 'unsupported';
}

function getDownloadPath(file) {
  return file.download_url ? file.download_url.replace(/^\/api/, '') : `/files/${file.id}/download/`;
}

function usePreview(file) {
  const [state, setState] = useState({ content: '', previewUrl: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    const loadPreview = async () => {
      const previewType = getPreviewType(file.name);
      setState({ content: '', previewUrl: null, loading: true, error: null });
      if (previewType === 'unsupported') return setState({ content: '', previewUrl: null, loading: false, error: `Предпросмотр недоступен для файла ${file.name}` });
      try {
        const response = await api.get(getDownloadPath(file), { responseType: previewType === 'text' ? 'text' : 'blob' });
        if (cancelled) return;
        if (previewType === 'text') setState({ content: response.data, previewUrl: null, loading: false, error: null });
        else { objectUrl = URL.createObjectURL(response.data); setState({ content: '', previewUrl: objectUrl, loading: false, error: null }); }
      } catch (err) {
        if (!cancelled) setState({ content: '', previewUrl: null, loading: false, error: err.response?.data?.detail || err.message || 'Не удалось загрузить файл для предпросмотра' });
      }
    };
    loadPreview();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file]);
  return state;
}

function PreviewContent({ file, state }) {
  const type = getPreviewType(file.name);
  const mediaStyle = { maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 };
  if (state.loading) return <div style={{ color: '#9ca3af' }}>Загрузка данных...</div>;
  if (state.error) return <div style={{ color: '#b91c1c', fontWeight: 600 }}>{state.error}</div>;
  if (type === 'image') return <img src={state.previewUrl} alt="Preview" style={mediaStyle} />;
  if (type === 'video') return <video src={state.previewUrl} style={{ ...mediaStyle, width: '100%', background: '#000' }} controls />;
  if (type === 'audio') return <audio src={state.previewUrl} controls style={{ width: '100%' }} />;
  if (type === 'pdf') return <object data={state.previewUrl} type="application/pdf" style={{ width: '100%', height: '70vh' }} />;
  return <pre style={{ width: '100%', maxHeight: '70vh', overflow: 'auto', background: '#fff', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{state.content}</pre>;
}

const baseButtonStyle = {
  border: '1px solid transparent',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  minHeight: 38,
  padding: '9px 16px',
  transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
};

const downloadButtonStyle = {
  ...baseButtonStyle,
  background: '#dcefe3',
  borderColor: '#b7dbc5',
  color: '#1f6b43',
  boxShadow: '0 6px 16px rgba(31, 107, 67, 0.12)',
};

const closeButtonStyle = {
  ...baseButtonStyle,
  background: '#f4dddd',
  borderColor: '#e4bbbb',
  color: '#8a2f2f',
  boxShadow: '0 6px 16px rgba(138, 47, 47, 0.12)',
};

async function downloadFile(file, setError, setDownloading) {
  setDownloading(true);
  try {
    const response = await api.get(getDownloadPath(file), { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = blobUrl; link.setAttribute('download', file.name); link.click(); URL.revokeObjectURL(blobUrl);
  } catch (err) {
    setError(err.response?.data?.detail || err.message || 'Не удалось скачать файл');
  } finally {
    setDownloading(false);
  }
}

export default function FilePreviewModal({ file, onClose }) {
  const state = usePreview(file);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [hoveredButton, setHoveredButton] = useState('');
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const closeButtonCurrentStyle = {
    ...closeButtonStyle,
    ...(hoveredButton === 'close' ? { background: '#efd0d0', borderColor: '#dca7a7', boxShadow: '0 8px 20px rgba(138, 47, 47, 0.16)', transform: 'translateY(-1px)' } : {}),
  };
  const downloadButtonCurrentStyle = {
    ...downloadButtonStyle,
    ...(hoveredButton === 'download' && !downloading ? { background: '#cfe8d8', borderColor: '#a7d0b7', boxShadow: '0 8px 20px rgba(31, 107, 67, 0.16)', transform: 'translateY(-1px)' } : {}),
    ...(downloading ? { cursor: 'not-allowed', opacity: 0.68, transform: 'none' } : {}),
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 2000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(95vw, 920px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'center', padding: 16, borderBottom: '1px solid #eef2f7' }}><strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</strong></div>
        <div style={{ flex: 1, overflow: 'auto', background: '#f7fafc', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PreviewContent file={file} state={{ ...state, error: state.error || downloadError }} /></div>
        <div style={{ padding: 14, borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', gap: 12 }}><button type="button" style={downloadButtonCurrentStyle} onMouseEnter={() => setHoveredButton('download')} onMouseLeave={() => setHoveredButton('')} onClick={() => downloadFile(file, setDownloadError, setDownloading)} disabled={downloading}>{downloading ? 'Скачивание...' : 'Скачать'}</button><button type="button" style={closeButtonCurrentStyle} onMouseEnter={() => setHoveredButton('close')} onMouseLeave={() => setHoveredButton('')} onClick={onClose}>Закрыть</button></div>
      </div>
    </div>
  );
}

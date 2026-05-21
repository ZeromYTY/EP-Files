import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Alert, Box, IconButton, LinearProgress, Paper, Typography } from '@mui/material';
import { CheckCircle, Close, CloudUpload } from '@mui/icons-material';
import api from '../../api/axios';

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Б';
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${parseFloat((bytes / (1024 ** index)).toFixed(1))} ${sizes[index]}`;
}

function UploadItem({ uploadFile }) {
  const completed = uploadFile.status === 'completed';
  return (
    <Paper sx={{ p: 2, mb: 1, borderRadius: '8px', backgroundColor: completed ? '#e8f5e9' : '#fff', border: '1px solid', borderColor: completed ? '#4CAF50' : '#e0e0e0' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        {completed ? <CheckCircle sx={{ color: '#4CAF50', fontSize: 24 }} /> : <Typography variant="caption" sx={{ color: '#2196F3', width: 36 }}>{Math.round(uploadFile.progress)}%</Typography>}
        <Box sx={{ flex: 1 }}><Typography variant="body2" sx={{ fontWeight: 500 }}>{uploadFile.file.name}</Typography><Typography variant="caption" color="text.secondary">{formatFileSize(uploadFile.file.size)}</Typography></Box>
        {completed && <Typography variant="caption" sx={{ color: '#4CAF50', fontWeight: 600 }}>Загружено</Typography>}
      </Box>
      {!completed && <LinearProgress variant="determinate" value={uploadFile.progress} sx={{ height: 6, borderRadius: 3 }} />}
    </Paper>
  );
}

function ErrorList({ errors, removeError }) {
  return (
    <Box sx={{ mt: 2 }}>
      {errors.map((error, index) => <Alert key={error} severity="error" sx={{ mb: 1 }} action={<IconButton color="inherit" size="small" onClick={() => removeError(index)}><Close fontSize="inherit" /></IconButton>}>{error}</Alert>)}
    </Box>
  );
}

export default function FileUpload({ onUploadComplete, onUploadError, folderId = null }) {
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const uploadFileToDjango = useCallback(async (uploadFile) => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);
    if (folderId) formData.append('folder_id', folderId);
    try {
      const response = await api.post('/upload/', formData, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress: (event) => setUploadingFiles((prev) => prev.map((file) => (file.id === uploadFile.id ? { ...file, progress: Math.round((event.loaded * 100) / event.total) } : file))) });
      setUploadingFiles((prev) => prev.map((file) => (file.id === uploadFile.id ? { ...file, status: 'completed', progress: 100 } : file)));
      onUploadComplete?.(response.data);
      setTimeout(() => setUploadingFiles((prev) => prev.filter((file) => file.id !== uploadFile.id)), 2000);
    } catch (error) {
      setUploadingFiles((prev) => prev.filter((file) => file.id !== uploadFile.id));
      setErrors((prev) => [...prev, `Ошибка с файлом "${uploadFile.file.name}": ${error.response?.data?.detail || error.response?.data?.error || 'Ошибка доступа или сервера.'}`]);
      onUploadError?.(error);
    }
  }, [folderId, onUploadComplete, onUploadError]);
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setErrors((prev) => [...prev, ...rejectedFiles.map((item) => `Файл "${item.file.name}" не может быть загружен`)]);
    const filesToUpload = acceptedFiles.map((file) => ({ file, id: Math.random().toString(36).slice(2, 11), progress: 0, status: 'uploading' }));
    setUploadingFiles((prev) => [...prev, ...filesToUpload]);
    filesToUpload.forEach(uploadFileToDjango);
  }, [uploadFileToDjango]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxFiles: 10, maxSize: MAX_FILE_SIZE });
  return (
    <Box sx={{ mb: 3 }}>
      <Paper {...getRootProps()} elevation={0} sx={{ p: 4, borderRadius: '12px', border: '2px dashed', borderColor: isDragActive ? '#2196F3' : '#e0e0e0', backgroundColor: isDragActive ? '#e3f2fd' : '#fafafa', cursor: 'pointer', textAlign: 'center' }}>
        <input {...getInputProps()} /><CloudUpload sx={{ fontSize: 64, color: isDragActive ? '#2196F3' : '#9e9e9e', mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 600, color: isDragActive ? '#2196F3' : '#202124', mb: 1 }}>{isDragActive ? 'Отпустите файлы здесь...' : 'Перетащите файлы сюда'}</Typography>
        <Typography variant="body2" color="text.secondary">или нажмите для выбора (макс. 100 MB, до 10 файлов)</Typography>
      </Paper>
      {errors.length > 0 && <ErrorList errors={errors} removeError={(index) => setErrors((prev) => prev.filter((_, itemIndex) => itemIndex !== index))} />}
      {uploadingFiles.length > 0 && <Box sx={{ mt: 2 }}>{uploadingFiles.map((uploadFile) => <UploadItem key={uploadFile.id} uploadFile={uploadFile} />)}</Box>}
    </Box>
  );
}

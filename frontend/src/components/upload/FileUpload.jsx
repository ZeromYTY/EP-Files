import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Paper,
  IconButton,
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Close,
} from '@mui/icons-material';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export default function FileUpload({ onUploadComplete, onUploadError, folderId = null }) {
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [errors, setErrors] = useState([]);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    const newErrors = [];
    
    // Обработка отклонённых файлов
    rejectedFiles.forEach(fileRejection => {
      if (fileRejection.errors[0].code === 'file-too-large') {
        newErrors.push(`Файл "${fileRejection.file.name}" слишком большой (макс. 100 MB)`);
      }
    });
    
    if (newErrors.length > 0) {
      setErrors(prev => [...prev, ...newErrors]);
    }
    
    // Добавляем файлы в очередь загрузки
    if (acceptedFiles.length > 0) {
      const filesToUpload = acceptedFiles.map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        progress: 0,
        status: 'uploading',
      }));
      
      setUploadingFiles(prev => [...prev, ...filesToUpload]);
      
      // Имитируем загрузку каждого файла
      filesToUpload.forEach(uploadFile => {
        simulateUpload(uploadFile);
      });
    }
  }, [folderId]);

  const simulateUpload = (uploadFile) => {
    const interval = setInterval(() => {
      setUploadingFiles(prev => 
        prev.map(f => {
          if (f.id === uploadFile.id) {
            const newProgress = Math.min(f.progress + Math.random() * 30, 100);
            
            if (newProgress >= 100) {
              clearInterval(interval);
              setTimeout(() => {
                setUploadingFiles(prevFiles => 
                  prevFiles.map(pf => 
                    pf.id === uploadFile.id 
                      ? { ...pf, progress: 100, status: 'completed' }
                      : pf
                  )
                );
                
                if (onUploadComplete) {
                  onUploadComplete({
                    name: uploadFile.file.name,
                    size: uploadFile.file.size,
                    type: uploadFile.file.type,
                  });
                }
                
                setTimeout(() => {
                  setUploadingFiles(prev => prev.filter(f => f.id !== uploadFile.id));
                }, 2000);
              }, 500);
              
              return { ...f, progress: 100 };
            }
            
            return { ...f, progress: newProgress };
          }
          return f;
        })
      );
    }, 500);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 10,
    maxSize: MAX_FILE_SIZE,
  });

  const removeError = (index) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Dropzone */}
      <Paper
        {...getRootProps()}
        elevation={0}
        sx={{
          p: 4,
          borderRadius: '12px',
          border: '2px dashed',
          borderColor: isDragActive ? '#2196F3' : '#e0e0e0',
          backgroundColor: isDragActive ? '#e3f2fd' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          textAlign: 'center',
          '&:hover': {
            borderColor: '#2196F3',
            backgroundColor: '#f5f5f5',
          },
        }}
      >
        <input {...getInputProps()} />
        
        <CloudUpload 
          sx={{ 
            fontSize: 64, 
            color: isDragActive ? '#2196F3' : '#9e9e9e',
            mb: 2,
          }} 
        />
        
        {isDragActive ? (
          <Typography variant="h6" sx={{ color: '#2196F3', fontWeight: 600 }}>
            Отпустите файлы здесь...
          </Typography>
        ) : (
          <>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#202124', mb: 1 }}>
              Перетащите файлы сюда
            </Typography>
            <Typography variant="body2" color="text.secondary">
              или нажмите для выбора (макс. 100 MB, до 10 файлов)
            </Typography>
          </>
        )}
      </Paper>

      {/* Ошибки */}
      {errors.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {errors.map((error, index) => (
            <Alert
              key={index}
              severity="error"
              sx={{ mb: 1 }}
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => removeError(index)}
                >
                  <Close fontSize="inherit" />
                </IconButton>
              }
            >
              {error}
            </Alert>
          ))}
        </Box>
      )}

      {/* Прогресс загрузки */}
      {uploadingFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {uploadingFiles.map(uploadFile => (
            <Paper
              key={uploadFile.id}
              sx={{
                p: 2,
                mb: 1,
                borderRadius: '8px',
                backgroundColor: uploadFile.status === 'completed' ? '#e8f5e9' : '#fff',
                border: '1px solid',
                borderColor: uploadFile.status === 'completed' ? '#4CAF50' : '#e0e0e0',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                {uploadFile.status === 'completed' ? (
                  <CheckCircle sx={{ color: '#4CAF50', fontSize: 24 }} />
                ) : (
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: '#2196F3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.75rem' }}>
                      {Math.round(uploadFile.progress)}%
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#202124' }}>
                    {uploadFile.file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(uploadFile.file.size)}
                  </Typography>
                </Box>
                
                {uploadFile.status === 'completed' && (
                  <Typography variant="caption" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                    Загружено
                  </Typography>
                )}
              </Box>
              
              {uploadFile.status !== 'completed' && (
                <LinearProgress 
                  variant="determinate" 
                  value={uploadFile.progress}
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    backgroundColor: '#f0f0f0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#2196F3',
                    },
                  }}
                />
              )}
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}
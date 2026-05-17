import { useDropzone } from 'react-dropzone';
import { Box, Typography, LinearProgress, Paper } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

export default function FilesPageUploader({ onFileDropped, isUploading, uploadProgress }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        onFileDropped(acceptedFiles[0]);
      }
    },
    disabled: isUploading,
    maxFiles: 1,
  });

  return (
    <Box sx={{ mb: 4 }}>
      <Paper
        {...getRootProps()}
        elevation={0}
        sx={{
          p: 4,
          borderRadius: '12px',
          border: '2px dashed',
          borderColor: isDragActive ? '#2196F3' : '#e0e0e0',
          backgroundColor: isDragActive ? '#e3f2fd' : '#fafafa',
          cursor: isUploading ? 'not-allowed' : 'pointer',
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
            fontSize: 48,
            color: isDragActive ? '#2196F3' : '#9e9e9e',
            mb: 1,
          }}
        />

        {isDragActive ? (
          <Typography variant="h6" sx={{ color: '#2196F3', fontWeight: 600 }}>
            Отпустите файл для загрузки...
          </Typography>
        ) : (
          <>
            <Typography variant="body1" sx={{ fontWeight: 600, color: '#202124', mb: 0.5 }}>
              Перетащите файл сюда для быстрой загрузки
            </Typography>
            <Typography variant="caption" color="text.secondary">
              или нажмите для выбора на компьютере (макс. 100 MB)
            </Typography>
          </>
        )}
      </Paper>

      {isUploading && (
        <Paper sx={{ p: 2, mt: 2, borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Загрузка файла на сервер...</Typography>
            <Typography variant="body2" fontWeight="bold" color="primary">{uploadProgress}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={uploadProgress}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Paper>
      )}
    </Box>
  );
}

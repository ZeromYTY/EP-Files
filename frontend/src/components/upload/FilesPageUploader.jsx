import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

/**
 * Drag&drop-зона для быстрой загрузки файла.
 */
export default function FilesPageUploader({
  onFileDropped,
  isUploading = false,
  uploadProgress = 0,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenFileDialog = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile && onFileDropped) {
      onFileDropped(droppedFile);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile && onFileDropped) {
      onFileDropped(selectedFile);
    }

    event.target.value = '';
  };

  return (
    <Paper
      onClick={handleOpenFileDialog}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        p: 3,
        mb: 3,
        textAlign: 'center',
        cursor: isUploading ? 'default' : 'pointer',
        border: '2px dashed',
        borderColor: isDragging ? '#2196F3' : '#90caf9',
        backgroundColor: isDragging ? 'rgba(33, 150, 243, 0.08)' : 'rgba(33, 150, 243, 0.03)',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: isUploading ? '#90caf9' : '#2196F3',
          backgroundColor: isUploading
            ? 'rgba(33, 150, 243, 0.03)'
            : 'rgba(33, 150, 243, 0.08)',
        },
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <CloudUpload sx={{ fontSize: 44, color: '#2196F3' }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {isUploading ? 'Загрузка файла...' : 'Перетащите файл сюда'}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          или нажмите на область, чтобы выбрать файл
        </Typography>

        {isUploading && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {uploadProgress}%
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
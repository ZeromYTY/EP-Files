import { useRef, useState } from 'react';
import { Box, LinearProgress, Paper, Typography } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

export default function FilesPageUploader({ onFileDropped, isUploading = false, uploadProgress = 0 }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const openFileDialog = () => !isUploading && fileInputRef.current?.click();
  const stopDrag = (event) => { event.preventDefault(); event.stopPropagation(); };
  const markDragging = (event) => { stopDrag(event); if (!isUploading) setIsDragging(true); };
  const handleDrop = (event) => {
    stopDrag(event);
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (!isUploading && droppedFile) onFileDropped?.(droppedFile);
  };
  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) onFileDropped?.(selectedFile);
    event.target.value = '';
  };
  return (
    <Paper onClick={openFileDialog} onDragEnter={markDragging} onDragOver={markDragging} onDragLeave={(event) => { stopDrag(event); setIsDragging(false); }} onDrop={handleDrop} sx={{ p: { xs: 2, sm: 3 }, mb: 3, textAlign: 'center', cursor: isUploading ? 'default' : 'pointer', border: '2px dashed', borderColor: isDragging ? 'primary.main' : 'rgba(68, 215, 182, 0.32)', backgroundColor: isDragging ? 'rgba(68, 215, 182, 0.08)' : 'rgba(255,255,255,0.025)' }}>
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <CloudUpload sx={{ fontSize: { xs: 36, sm: 44 }, color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{isUploading ? 'Загрузка файла...' : 'Перетащите файл сюда'}</Typography>
        <Typography variant="body2" color="text.secondary">или нажмите на область, чтобы выбрать файл</Typography>
        {isUploading && <Box sx={{ width: '100%', mt: 2 }}><LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 8, borderRadius: 4 }} /><Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>{uploadProgress}%</Typography></Box>}
      </Box>
    </Paper>
  );
}

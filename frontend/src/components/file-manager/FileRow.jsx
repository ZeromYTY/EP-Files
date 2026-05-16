import { useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import { StarBorder, Star, MoreVert, Download } from '@mui/icons-material';

export default function FileRow({ file, getFileIcon, formatFileSize, formatDate, onFolderClick }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const handleDownload = (e) => {
    e.stopPropagation();
    console.log('Download file:', file);
    
    // Имитация скачивания
    setToast({
      open: true,
      message: `📥 Скачивание: ${file.name}`,
      severity: 'success',
    });
    
    // В будущем: вызов API для скачивания
    // window.open(`/api/files/${file.id}/download`, '_blank');
  };

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
    
    setToast({
      open: true,
      message: isFavorite 
        ? `⭐ Удалено из избранного: ${file.name}`
        : `⭐ Добавлено в избранное: ${file.name}`,
      severity: 'info',
    });
    
    // В будущем: вызов API для обновления избранного
    // api.post(`/files/${file.id}/favorite`, { favorite: !isFavorite });
  };

  const handleCloseToast = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  return (
    <>
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: '40px 1fr 150px 120px 120px',
          p: 2, 
          alignItems: 'center', 
          cursor: file.type === 'folder' ? 'pointer' : 'default',
          transition: 'background-color 0.2s ease', 
          '&:hover': { backgroundColor: '#f5f8ff' }, 
          borderBottom: '1px solid #f0f0f0' 
        }} 
        onClick={() => file.type === 'folder' && onFolderClick(file.id)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {getFileIcon(file)}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 500, 
              color: '#202124',
              '&:hover': { color: '#2196F3' } 
            }}
          >
            {file.name}
          </Typography>
        </Box>
        
        <Typography variant="caption" color="text.secondary">
          {formatDate(file.modified)}
        </Typography>
        
        <Typography variant="caption" color="text.secondary">
          {file.size ? formatFileSize(file.size) : '—'}
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          {file.type === 'file' && (
            <>
              {/* Кнопка Скачать */}
              <Tooltip title="Скачать">
                <IconButton 
                  size="small" 
                  onClick={handleDownload}
                  sx={{ color: '#2196F3' }}
                >
                  <Download sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              
              {/* Кнопка Избранное */}
              <Tooltip title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}>
                <IconButton 
                  size="small" 
                  onClick={handleToggleFavorite}
                  sx={{ 
                    color: isFavorite ? '#FFC107' : '#9e9e9e',
                    '&:hover': { color: isFavorite ? '#FFB300' : '#757575' }
                  }}
                >
                  {isFavorite 
                    ? <Star sx={{ fontSize: 18, color: '#FFC107' }} /> 
                    : <StarBorder sx={{ fontSize: 18 }} />
                  }
                </IconButton>
              </Tooltip>
            </>
          )}
          
          {/* Меню действий */}
          <Tooltip title="Ещё">
            <IconButton size="small" onClick={(e) => e.stopPropagation()}>
              <MoreVert sx={{ fontSize: 18, color: '#9e9e9e' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Toast уведомления */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseToast} 
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}
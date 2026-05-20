import { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import { StarBorder, Star, MoreVert, Download as DownloadIcon } from '@mui/icons-material';
import api from '../../api/axios';

export default function FileRow({
  file,
  getFileIcon,
  formatFileSize,
  formatDate,
  onFolderClick,
  onDownloadClick,
  onMenuOpen,
  activeDropFolderId,
  setActiveDropFolderId,
  handleFolderDrop
}) {
  const [isFavorite, setIsFavorite] = useState(file.is_favorite || false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const isFolder = file.type === 'folder';
  const rawDate = file.created_at || file.updated_at || file.date || new Date().toISOString();

  const isFolderHovered = isFolder && activeDropFolderId === file.id;

  const handleDownload = (e) => {
    e.stopPropagation();
    if (onDownloadClick) {
      onDownloadClick(file.id, file.name, file.type);
    }
  };

  useEffect(() => {
    setIsFavorite(file.is_favorite);
  }, [file.is_favorite]);

  const handleToggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await api.post(`/favorite/${file.id}/`, { type: file.type });
      const newFavoriteStatus = response.data.is_favorite;
      setIsFavorite(newFavoriteStatus);

      setToast({
        open: true,
        message: newFavoriteStatus
          ? `⭐ Добавлено в избранное: ${file.name}`
          : `⭐ Удалено из избранного: ${file.name}`,
        severity: 'info',
      });
    } catch (err) {
      console.error('Ошибка при сохранении избранного:', err);
      setToast({
        open: true,
        message: '⚠ Не удалось обновить статус на сервере',
        severity: 'error',
      });
    }
  };

  const handleCloseToast = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  return (
    <>
      <Box
        onDragOver={(e) => {
          if (!isFolder) return;
          e.preventDefault();
          e.stopPropagation();
          if (activeDropFolderId !== file.id) setActiveDropFolderId(file.id);
        }}
        onDragLeave={(e) => {
          if (!isFolder) return;
          e.preventDefault();
          e.stopPropagation();
          setActiveDropFolderId(null);
        }}
        onDrop={(e) => {
          if (!isFolder) return;
          if (handleFolderDrop) handleFolderDrop(e, file.id);
        }}
        sx={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 150px 120px 120px',
          p: 2,
          alignItems: 'center',
          cursor: isFolder ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          backgroundColor: isFolderHovered ? '#e0f2fe' : '#fff',
          boxShadow: isFolderHovered ? 'inset 0 0 0 2px #2196F3' : 'none',
          '&:hover': { backgroundColor: isFolderHovered ? '#e0f2fe' : '#f5f8ff' },
          borderBottom: '1px solid #f0f0f0',
          position: 'relative',
          zIndex: isFolderHovered ? 10 : 1,
        }}
        onClick={() => isFolder && onFolderClick(file.id)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          {getFileIcon(file)}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, pointerEvents: 'none' }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500, color: '#202124' }}>
            {file.name}
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ pointerEvents: 'none' }}>
          {formatDate(rawDate)}
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ pointerEvents: 'none' }}>
          {isFolder ? '—' : (file.size ? formatFileSize(file.size) : '0 Б')}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, zIndex: 20 }}>
          <Tooltip title={isFolder ? "Скачать ZIP-архив" : "Скачать файл"}>
            <IconButton size="small" onClick={handleDownload} sx={{ color: '#2196F3' }}>
              <DownloadIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

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
                ? <Star sx={{ fontSize: 18, color: '#FFC107', pointerEvents: 'none' }} />
                : <StarBorder sx={{ fontSize: 18, pointerEvents: 'none' }} />
              }
            </IconButton>
          </Tooltip>

          <Tooltip title="Ещё">
            <IconButton size="small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onMenuOpen) onMenuOpen(e, { ...file, isFavorite }, file.type); }}>
              <MoreVert sx={{ fontSize: 18, color: '#9e9e9e' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

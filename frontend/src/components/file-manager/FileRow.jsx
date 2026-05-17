import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';
import { StarBorder, Star, MoreVert, Download, Delete } from '@mui/icons-material';

export default function FileRow({ file, getFileIcon, formatFileSize, formatDate, onFolderClick, onDownloadClick, onDeleteClick }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const openMenu = Boolean(anchorEl);

  const handleMenuOpen = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = (e) => {
    if (e) e.stopPropagation();
    setAnchorEl(null);
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (onDownloadClick) {
      onDownloadClick(file.id, file.name);
    }
    handleMenuClose();
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
    handleMenuClose();
  };

  const handleOpenDeleteDialog = (e) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleCloseDeleteDialog = (e) => {
    if (e) e.stopPropagation();
    setIsDeleteDialogOpen(false);
  };

    const handleConfirmDelete = (e) => {
    e.stopPropagation();
    if (onDeleteClick) {
      onDeleteClick(file.id, file.name);
    }
    setIsDeleteDialogOpen(false);
  };


  const handleCloseToast = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  const rawDate = file.created_at || file.updated_at || file.modified || new Date().toISOString();

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
          {formatDate(rawDate)}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {file.size ? formatFileSize(file.size) : '—'}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          {file.type === 'file' && (
            <>
              <Tooltip title="Скачать">
                <IconButton
                  size="small"
                  onClick={handleDownload}
                  sx={{ color: '#2196F3' }}
                >
                  <Download sx={{ fontSize: 18 }} />
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
                    ? <Star sx={{ fontSize: 18, color: '#FFC107' }} />
                    : <StarBorder sx={{ fontSize: 18 }} />
                  }
                </IconButton>
              </Tooltip>
            </>
          )}

          <Tooltip title="Ещё">
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVert sx={{ fontSize: 18, color: '#9e9e9e' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: '8px', minWidth: 150 } }}
      >
        <MenuItem onClick={handleDownload}>
          <Download sx={{ fontSize: 18, mr: 1.5, color: '#616161' }} /> Скачать
        </MenuItem>
        <MenuItem onClick={handleToggleFavorite}>
          <Star sx={{ fontSize: 18, mr: 1.5, color: '#616161' }} /> {isFavorite ? 'Удалить из избранного' : 'В избранное'}
        </MenuItem>
        <MenuItem onClick={handleOpenDeleteDialog} sx={{ color: '#D32F2F' }}>
          <Delete sx={{ fontSize: 18, mr: 1.5, color: '#D32F2F' }} /> Удалить
        </MenuItem>
      </Menu>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            p: 1,
            backgroundColor: '#ffffff',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1, color: '#202124' }}>
          Удалить файл?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#5f6368', fontSize: '0.95rem' }}>
            Вы действительно хотите удалить файл "{file.name}"? Это действие нельзя будет отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={handleCloseDeleteDialog}
            sx={{
              color: '#2196F3',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              '&:hover': { backgroundColor: '#f5f8ff' }
            }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              boxShadow: 'none',
              backgroundColor: '#D32F2F',
              fontSize: '0.9rem',
              fontWeight: 500,
              '&:hover': { backgroundColor: '#C62828', boxShadow: 'none' }
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

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

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, List, ListItem, ListItemText, IconButton, Tooltip, Stack, Chip, Menu, MenuItem } from '@mui/material';
import { InsertDriveFile, Download, Delete, CloudUpload, MoreVert, Share, SearchOff } from '@mui/icons-material';

export default function FilesTable({
  loading,
  files,
  allFiles,
  searchQuery,
  isUploading,
  onFileDropped,
  onFileRejected,
  formatFileSize,
  formatDate,
  handleDownload,
  handleOpenDeleteDialog,
  handleOpenShareDialog
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const openMenu = Boolean(anchorEl);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles && rejectedFiles.length > 0 && onFileRejected) {
        const fileError = rejectedFiles[0].errors[0];
        if (fileError.code === 'file-too-large') {
          onFileRejected(rejectedFiles[0].file.name, 'Файл превышает максимальный размер 100 MB');
        } else {
          onFileRejected(rejectedFiles[0].file.name, 'Не удалось загрузить файл');
        }
        return;
      }

      if (acceptedFiles && acceptedFiles.length > 0 && onFileDropped) {
        onFileDropped(acceptedFiles[0]);
      }
    },
    noClick: true,
    disabled: isUploading,
    maxSize: 100 * 1024 * 1024
  });

  const handleMenuOpen = (e, file) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setActiveFile(file);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setActiveFile(null);
  };

  const handleActionDownload = () => {
    if (activeFile && handleDownload) {
      handleDownload(activeFile.id, activeFile.name);
    }
    handleMenuClose();
  };

  const handleActionShare = () => {
    if (activeFile && handleOpenShareDialog) {
      handleOpenShareDialog(activeFile.id, activeFile.name);
    }
    handleMenuClose();
  };

  const handleActionDelete = () => {
    if (activeFile && handleOpenDeleteDialog) {
      handleOpenDeleteDialog(activeFile.id, activeFile.name);
    }
    handleMenuClose();
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>Загрузка...</Typography>
      </Box>
    );
  }

  const isSearchEmptyResult = (allFiles && allFiles.length > 0) && (files && files.length === 0);

  return (
    <Box {...getRootProps()} sx={{ position: 'relative', width: '100%', minHeight: '250px', display: 'flex', flexDirection: 'column' }}>
      <input {...getInputProps()} />

      {isDragActive && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(33, 150, 243, 0.08)',
            border: '2px dashed #2196F3',
            borderRadius: '8px',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Box sx={{ textAlign: 'center', backgroundColor: '#fff', p: 3, borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <CloudUpload sx={{ fontSize: 48, color: '#2196F3', mb: 1 }} />
            <Typography variant="body1" sx={{ color: '#2196F3', fontWeight: 600 }}>
              Перетащите файл для загрузки в эту таблицу
            </Typography>
          </Box>
        </Box>
      )}

      {files.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            py: 6,
            textAlign: 'center'
          }}
        >
          {isSearchEmptyResult || searchQuery ? (
            <>
              <SearchOff sx={{ fontSize: 72, color: '#cbd5e1', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e293b', mb: 1 }}>
                Файлы не найдены
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', maxWidth: '300px' }}>
                По вашему запросу ничего не нашлось. Попробуйте сбросить поиск.
              </Typography>
            </>
          ) : (
            <>
              <CloudUpload sx={{ fontSize: 72, color: '#cbd5e1', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e293b', mb: 1 }}>
                Пусто
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', maxWidth: '300px' }}>
                Попробуйте добавить файлы, перетащив их сюда
              </Typography>
            </>
          )}
        </Box>
      ) : (
        <List sx={{ flexGrow: 1 }}>
          {files.map((file) => (
            <ListItem
              key={file.id}
              sx={{
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                mb: 1,
                '&:hover': { bgcolor: '#f5f5f5' },
              }}
            >
              <InsertDriveFile color="primary" sx={{ mr: 2 }} />
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1">{file.name}</Typography>
                    <Chip label={formatFileSize(file.size)} size="small" variant="outlined" />
                  </Stack>
                }
                secondary={`Загружено: ${formatDate(file.date || file.created_at || file.updated_at)}`}
              />
              <Tooltip title="Действия">
                <IconButton onClick={(e) => handleMenuOpen(e, file)}>
                  <MoreVert />
                </IconButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      )}

      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: '8px', minWidth: 160 } }}
      >
        <MenuItem onClick={handleActionDownload}>
          <Download sx={{ fontSize: 18, mr: 1.5, color: '#64748b' }} /> Скачать
        </MenuItem>
        <MenuItem onClick={handleActionShare}>
          <Share sx={{ fontSize: 18, mr: 1.5, color: '#64748b' }} /> Поделиться
        </MenuItem>
        <MenuItem onClick={handleActionDelete} sx={{ color: '#ef4444' }}>
          <Delete sx={{ fontSize: 18, mr: 1.5, color: '#ef4444' }} /> Удалить
        </MenuItem>
      </Menu>
    </Box>
  );
}

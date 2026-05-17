import { useState, useEffect } from 'react';
import { Grid, Paper, Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Folder, Description, TableChart, PictureAsPdf, CloudUpload, MoreVert, Download as DownloadIcon } from '@mui/icons-material';
import FileRow from './FileRow';

function GridFolderCard({ folder, onFolderClick, onMenuOpen, onDownloadClick, onFileDropped, formatDate, formatFileSize, activeDropFolderId, setActiveDropFolderId, handleFolderDrop }) {
  const isFolderHovered = activeDropFolderId === folder.id;

  return (
    <Paper
      elevation={0}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeDropFolderId !== folder.id) setActiveDropFolderId(folder.id);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveDropFolderId(null);
      }}
      onDrop={(e) => {
        handleFolderDrop(e, folder.id);
      }}
      sx={{
        p: 2,
        borderRadius: '12px',
        border: isFolderHovered ? '2px solid #2196F3' : '1px solid #e0e0e0',
        backgroundColor: isFolderHovered ? '#e0f2fe' : '#fff',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s ease',
        transform: isFolderHovered ? 'scale(1.04)' : 'none',
        zIndex: isFolderHovered ? 20 : 1,
        '&:hover': {
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          transform: isFolderHovered ? 'scale(1.04)' : 'translateY(-2px)',
          borderColor: '#2196F3',
          '& .grid-menu-btn': { opacity: 1 },
          '& .download-btn': { opacity: 1 }
        }
      }}
      onClick={() => onFolderClick(folder.id)}
    >
      <Tooltip title="Скачать как ZIP">
          <IconButton
            className="download-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onDownloadClick) onDownloadClick(folder.id, folder.name, 'folder'); // Жестко пишем 'folder'
            }}
            sx={{ position: 'absolute', top: 8, right: 40, opacity: 0, transition: 'opacity 0.2s', color: '#2196F3', zIndex: 30 }}
            size="small"
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>

      <IconButton
        className="grid-menu-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onMenuOpen) onMenuOpen(e, folder, 'folder');
        }}
        sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.2s', color: '#757575', zIndex: 30 }}
        size="small"
      >
        <MoreVert fontSize="small" />
      </IconButton>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, pointerEvents: 'none' }}>
        <Folder sx={{ fontSize: 40, color: '#FF9800' }} />
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 6, pointerEvents: 'none' }}>
        {folder.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ pointerEvents: 'none', display: 'block' }}>
        {formatDate(folder.created_at || folder.updated_at || folder.date || new Date().toISOString())}
        {folder.size > 0 && ` • ${formatFileSize(folder.size)}`}
      </Typography>
    </Paper>
  );
}

export default function FileList({ files, viewMode, onFolderClick, onDownloadClick, onDeleteClick, onFileDropped, onMenuOpen }) {
  const [activeDropFolderId, setActiveDropFolderId] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFolderDrop = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDropFolderId(null);
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFileDropped) {
      onFileDropped(e.dataTransfer.files, folderId);
    }
  };

  const handleGlobalDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (!activeDropFolderId && e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFileDropped) {
      onFileDropped(e.dataTransfer.files, null);
    }
    setActiveDropFolderId(null);
  };

  useEffect(() => {
    const handleDragLeaveGlobal = (e) => {
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setActiveDropFolderId(null);
        setIsDragActive(false);
      }
    };

    const handleGlobalDragEnd = (e) => {
      e.preventDefault();
      setActiveDropFolderId(null);
      setIsDragActive(false);
    };

    window.addEventListener('dragleave', handleDragLeaveGlobal);
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('drop', handleGlobalDragEnd);

    return () => {
      window.removeEventListener('dragleave', handleDragLeaveGlobal);
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('drop', handleGlobalDragEnd);
    };
  }, []);

  const getFileIcon = (file) => {
    if (file.type === 'folder') return <Folder sx={{ fontSize: 40, color: '#FF9800' }} />;
    const iconProps = { sx: { fontSize: 36 } };
    const extension = file.name ? file.name.split('.').pop().toLowerCase() : '';

    if (extension === 'pdf') return <PictureAsPdf {...iconProps} sx={{ ...iconProps.sx, color: '#F44336' }} />;
    if (['xlsx', 'xls', 'csv'].includes(extension)) return <TableChart {...iconProps} sx={{ ...iconProps.sx, color: '#4CAF50' }} />;
    return <Description {...iconProps} sx={{ ...iconProps.sx, color: '#2196F3' }} />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderGridMode = () => (
    <Grid container spacing={2}>
      {files.map((file) => {
        const isFolder = file.type === 'folder';

        return (
          <Grid item xs={12} sm={6} md={4} lg={3} key={`${file.type}-${file.id}`}>
            {isFolder ? (
              <GridFolderCard
                folder={file}
                onFolderClick={onFolderClick}
                onMenuOpen={onMenuOpen}
                onDownloadClick={onDownloadClick}
                onFileDropped={onFileDropped}
                formatDate={formatDate}
                formatFileSize={formatFileSize}
                activeDropFolderId={activeDropFolderId}
                setActiveDropFolderId={setActiveDropFolderId}
                handleFolderDrop={handleFolderDrop}
              />
            ) : (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    transform: 'translateY(-2px)',
                    borderColor: '#2196F3',
                    '& .grid-menu-btn': { opacity: 1 },
                    '& .download-btn': { opacity: 1 }
                  }
                }}
              >
                <Tooltip title="Скачать файл">
                  <IconButton
                    className="download-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onDownloadClick) onDownloadClick(file.id, file.name, file.type);
                    }}
                    sx={{ position: 'absolute', top: 8, right: 40, opacity: 0, transition: 'opacity 0.2s', color: '#2196F3', zIndex: 30 }}
                    size="small"
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <IconButton
                  className="grid-menu-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onMenuOpen) onMenuOpen(e, file, file.type);
                  }}
                  sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.2s', color: '#757575', zIndex: 30 }}
                  size="small"
                >
                  <MoreVert fontSize="small" />
                </IconButton>

                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  {getFileIcon(file)}
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 6 }}>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(file.created_at || file.updated_at || file.date || new Date().toISOString())}
                  {file.size && ` • ${formatFileSize(file.size)}`}
                </Typography>
              </Paper>
            )}
          </Grid>
        );
      })}
    </Grid>
  );

  const renderListMode = () => (
    <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden', backgroundColor: '#fff', position: 'relative' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 150px 120px 120px',
          p: 2,
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #e0e0e0',
          fontWeight: 600,
          fontSize: '0.85rem',
          color: '#616161'
        }}
      >
        <Box></Box>
        <Box>Имя</Box>
        <Box>Дата изменения</Box>
        <Box>Размер</Box>
        <Box></Box>
      </Box>

      {files.map((file) => (
        <FileRow
          key={`${file.type}-${file.id}`}
          file={file}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
          onFolderClick={onFolderClick}
          onDownloadClick={onDownloadClick}
          onDeleteClick={onDeleteClick}
          onMenuOpen={onMenuOpen}
          onFileDropped={onFileDropped}
          activeDropFolderId={activeDropFolderId}
          setActiveDropFolderId={setActiveDropFolderId}
          handleFolderDrop={handleFolderDrop}
        />
      ))}
    </Paper>
  );

  return (
    <Box
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }}
      onDrop={handleGlobalDrop}
      sx={{ position: 'relative', width: '100%', minHeight: '300px' }}
    >
      {isDragActive && !activeDropFolderId && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(33, 150, 243, 0.03)',
            border: '2px dashed #2196F3',
            borderRadius: '12px',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            backdropFilter: 'blur(1px)'
          }}
        >
          <Box sx={{ textAlign: 'center', backgroundColor: '#ffffff', px: 4, py: 2.5, borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <CloudUpload sx={{ fontSize: 44, color: '#2196F3', mb: 1, display: 'block', mx: 'auto' }} />
            <Typography variant="body2" sx={{ color: '#2196F3', fontWeight: 600 }}>
              Отпустите мышь для загрузки в текущую папку
            </Typography>
          </Box>
        </Box>
      )}

      {viewMode === 'grid' ? renderGridMode() : renderListMode()}
    </Box>
  );
}

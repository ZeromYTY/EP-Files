import { useDropzone } from 'react-dropzone';
import { Grid, Paper, Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Folder, Description, TableChart, PictureAsPdf, Download as DownloadIcon, CloudUpload } from '@mui/icons-material';
import FileRow from './FileRow';

export default function FileList({ files, viewMode, onFolderClick, onDownloadClick, onDeleteClick, onFileDropped, isUploading }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0 && onFileDropped) {
        onFileDropped(acceptedFiles[0]);
      }
    },
    noClick: true,
    disabled: isUploading,
    maxFiles: 1
  });

  const getFileIcon = (file) => {
    if (file.type === 'folder') return <Folder sx={{ fontSize: 40, color: '#FF9800' }} />;
    const iconProps = { sx: { fontSize: 36 } };
    switch (file.fileType) {
      case 'pdf': return <PictureAsPdf {...iconProps} sx={{ ...iconProps.sx, color: '#F44336' }} />;
      case 'sheet': return <TableChart {...iconProps} sx={{ ...iconProps.sx, color: '#4CAF50' }} />;
      default: return <Description {...iconProps} sx={{ ...iconProps.sx, color: '#2196F3' }} />;
    }
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
      {files.map((file) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              cursor: file.type === 'folder' ? 'pointer' : 'default',
              position: 'relative',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                transform: 'translateY(-2px)',
                borderColor: '#2196F3',
                '& .download-btn': { opacity: 1 }
              }
            }}
            onClick={() => file.type === 'folder' && onFolderClick(file.id)}
          >
            {file.type !== 'folder' && (
              <Tooltip title="Скачать">
                <IconButton
                  className="download-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDownloadClick) onDownloadClick(file.id, file.name);
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    color: '#2196F3'
                  }}
                  size="small"
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              {getFileIcon(file)}
            </Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 500,
                mb: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                pr: file.type !== 'folder' ? 3 : 0
              }}
            >
              {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(file.modified || file.created_at || file.updated_at || new Date().toISOString())}
              {file.size && ` • ${formatFileSize(file.size)}`}
            </Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );

  const renderListMode = () => (
    <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden', backgroundColor: '#fff' }}>
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
          key={file.id}
          file={file}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
          onFolderClick={onFolderClick}
          onDownloadClick={onDownloadClick}
          onDeleteClick={onDeleteClick}
        />

      ))}
    </Paper>
  );

  return (
    <Box {...getRootProps()} sx={{ position: 'relative', width: '100%' }}>
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
            borderRadius: '12px',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <Box sx={{ textAlign: 'center', backgroundColor: '#fff', p: 3, borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <CloudUpload sx={{ fontSize: 48, color: '#2196F3', mb: 1 }} />
            <Typography variant="body1" sx={{ color: '#2196F3', fontWeight: 600 }}>
              Перетащите файл сюда для загрузки в облако
            </Typography>
          </Box>
        </Box>
      )}

      {viewMode === 'grid' ? renderGridMode() : renderListMode()}
    </Box>
  );
}

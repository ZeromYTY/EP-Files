import { Grid, Paper, Box, Typography } from '@mui/material';
import { Folder, Description, TableChart, PictureAsPdf } from '@mui/icons-material';
import FileRow from './FileRow';

export default function FileList({ files, viewMode, onFolderClick }) {
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

  // Режим сетки
  if (viewMode === 'grid') {
    return (
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
                transition: 'all 0.2s ease', 
                '&:hover': { 
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)', 
                  transform: 'translateY(-2px)', 
                  borderColor: '#2196F3' 
                } 
              }} 
              onClick={() => file.type === 'folder' && onFolderClick(file.id)}
            >
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
                  whiteSpace: 'nowrap' 
                }}
              >
                {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(file.modified)}
                {file.size && ` • ${formatFileSize(file.size)}`}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    );
  }

  // Режим списка (по умолчанию)
  return (
    <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden', backgroundColor: '#fff' }}>
      {/* Заголовки таблицы */}
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: '40px 1fr 150px 120px 80px', 
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

      {/* Строки файлов */}
      {files.map((file) => (
        <FileRow 
          key={file.id} 
          file={file} 
          getFileIcon={getFileIcon} 
          formatFileSize={formatFileSize} 
          formatDate={formatDate} 
          onFolderClick={onFolderClick} 
        />
      ))}
    </Paper>
  );
}
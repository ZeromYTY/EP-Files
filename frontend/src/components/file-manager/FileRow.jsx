import { Box, Typography, IconButton } from '@mui/material';
import { StarBorder, MoreVert } from '@mui/icons-material';

export default function FileRow({ file, getFileIcon, formatFileSize, formatDate, onFolderClick }) {
  return (
    <Box 
      sx={{ 
        display: 'grid', 
        gridTemplateColumns: '40px 1fr 150px 120px 80px', 
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
        <IconButton size="small" onClick={(e) => e.stopPropagation()}>
          <StarBorder sx={{ fontSize: 18, color: '#9e9e9e' }} />
        </IconButton>
        <IconButton size="small" onClick={(e) => e.stopPropagation()}>
          <MoreVert sx={{ fontSize: 18, color: '#9e9e9e' }} />
        </IconButton>
      </Box>
    </Box>
  );
}
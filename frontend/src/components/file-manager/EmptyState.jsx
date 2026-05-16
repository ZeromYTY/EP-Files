import { Paper, Box, Typography, Button } from '@mui/material';
import { FolderOpen, Add, Upload } from '@mui/icons-material';

export default function EmptyState({ folderName }) {
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 6, 
        borderRadius: '16px', 
        border: '2px dashed #e0e0e0', 
        backgroundColor: '#fafafa', 
        textAlign: 'center' 
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <FolderOpen sx={{ fontSize: 80, color: '#bdbdbd' }} />
      </Box>
      
      <Typography variant="h6" sx={{ fontWeight: 600, color: '#424242', mb: 1 }}>
        В этой папке пусто
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        В {folderName} пока нет файлов или папок
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button 
          variant="outlined" 
          startIcon={<Add />} 
          sx={{ 
            borderColor: '#2196F3', 
            color: '#2196F3', 
            '&:hover': { borderColor: '#1976D2' } 
          }}
        >
          Новая папка
        </Button>
        <Button 
          variant="contained" 
          startIcon={<Upload />} 
          sx={{ 
            backgroundColor: '#2196F3', 
            '&:hover': { backgroundColor: '#1976D2' } 
          }}
        >
          Загрузить файл
        </Button>
      </Box>
    </Paper>
  );
}
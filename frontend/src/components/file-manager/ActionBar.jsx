import { Box, TextField, InputAdornment, Button } from '@mui/material';
import { Search, CloudUpload } from '@mui/icons-material';

export default function ActionBar({
  searchQuery,
  setSearchQuery,
  isUploading,
  storageStats,
  handleFileUpload
}) {
  return (
    <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <TextField
        placeholder="Поиск файлов..."
        size="small"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
        sx={{ flex: 1, minWidth: 200 }}
      />
      <Button
        variant="contained"
        component="label"
        startIcon={<CloudUpload />}
        disabled={isUploading || (storageStats && storageStats.usage_percent >= 100)}
        sx={{
          borderRadius: '8px',
          textTransform: 'none',
          backgroundColor: '#2196F3',
          '&:hover': { backgroundColor: '#1976D2' }
        }}
      >
        {isUploading ? 'Загрузка...' : 'Загрузить файл'}
        <input type="file" hidden onChange={handleFileUpload} disabled={isUploading} />
      </Button>
    </Box>
  );
}

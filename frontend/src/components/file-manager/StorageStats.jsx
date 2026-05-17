import { Box, Typography, Card, CardContent, Grid, LinearProgress, Alert } from '@mui/material';
import { Storage } from '@mui/icons-material';

export default function StorageStats({ stats, formatFileSize }) {
  if (!stats) return null;

  const getStorageColor = (percent) => {
    if (percent < 50) return 'success';
    if (percent < 80) return 'warning';
    return 'error';
  };

  return (
    <Card sx={{ mb: 3, backgroundColor: '#f5f5f5' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Storage sx={{ mr: 1, color: '#2196F3' }} />
          <Typography variant="h6">Хранилище</Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{stats.total_files}</Typography>
              <Typography variant="body2" color="text.secondary">Всего файлов</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{formatFileSize(stats.total_size)}</Typography>
              <Typography variant="body2" color="text.secondary">Использовано</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{formatFileSize(stats.available_space)}</Typography>
              <Typography variant="body2" color="text.secondary">Доступно</Typography>
            </Box>
          </Grid>
        </Grid>

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Использование хранилища</Typography>
            <Typography variant="body2" fontWeight="bold">{stats.usage_percent}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(stats.usage_percent, 100)}
            color={getStorageColor(stats.usage_percent)}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Лимит: {formatFileSize(stats.storage_limit)}
          </Typography>
        </Box>

        {stats.usage_percent > 80 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <strong>Внимание!</strong> Хранилище заполнено на {stats.usage_percent}%. Удалите ненужные файлы.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

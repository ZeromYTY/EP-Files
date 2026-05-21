import { Alert, Box, Card, CardContent, Grid, LinearProgress, Typography } from '@mui/material';
import { Storage } from '@mui/icons-material';

function storageColor(percent) {
  if (percent < 50) return 'success';
  if (percent < 80) return 'warning';
  return 'error';
}

function StatCell({ value, label }) {
  return (
    <Grid item xs={12} sm={4}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h4" color="primary">{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Box>
    </Grid>
  );
}

export default function StorageStats({ stats, formatFileSize }) {
  if (!stats) return null;
  return (
    <Card sx={{ mb: 3, backgroundColor: '#f5f5f5' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}><Storage sx={{ mr: 1, color: '#2196F3' }} /><Typography variant="h6">Хранилище</Typography></Box>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <StatCell value={stats.total_files} label="Всего файлов" />
          <StatCell value={formatFileSize(stats.total_size)} label="Использовано" />
          <StatCell value={formatFileSize(stats.available_space)} label="Доступно" />
        </Grid>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Использование хранилища</Typography>
          <Typography variant="body2" fontWeight="bold">{stats.usage_percent}%</Typography>
        </Box>
        <LinearProgress variant="determinate" value={Math.min(stats.usage_percent, 100)} color={storageColor(stats.usage_percent)} sx={{ height: 10, borderRadius: 5 }} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Лимит: {formatFileSize(stats.storage_limit)}</Typography>
        {stats.usage_percent > 80 && <Alert severity="warning" sx={{ mt: 2 }}><strong>Внимание!</strong> Хранилище заполнено на {stats.usage_percent}%. Удалите ненужные файлы.</Alert>}
      </CardContent>
    </Card>
  );
}

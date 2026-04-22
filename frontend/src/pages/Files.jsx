import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  LinearProgress,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Download,
  InsertDriveFile,
  Logout,
  Search,
  Storage,
  Folder,
} from '@mui/icons-material';

export default function Files() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storageStats, setStorageStats] = useState(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/files/');
      setFiles(response.data);
      setError('');
    } catch (err) {
      setError('Ошибка при загрузке файлов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const response = await api.get('/storage/stats/');
      setStorageStats(response.data);
    } catch (err) {
      console.error('Ошибка при загрузке статистики:', err);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchStorageStats();
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Размер файла превышает 100 MB');
      event.target.value = '';
      return;
    }

    if (storageStats && file.size > storageStats.available_space) {
      setError('Недостаточно места в хранилище');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError('');
      setSuccess('');

      const response = await api.post('/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      setSuccess(`Файл "${response.data.file.name}" успешно загружен!`);
      fetchFiles();
      fetchStorageStats();
      event.target.value = '';
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при загрузке файла');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await api.get(`/download/${fileId}/`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('У вас нет прав на скачивание этого файла');
      } else {
        setError('Ошибка при скачивании файла');
      }
      console.error(err);
    }
  };

  const handleDelete = async (fileId, fileName) => {
    if (!window.confirm(`Удалить файл "${fileName}"?`)) return;

    try {
      await api.delete(`/files/${fileId}/`);
      setSuccess(`Файл "${fileName}" удален`);
      fetchFiles();
      fetchStorageStats();
    } catch (err) {
      if (err.response?.status === 403) {
        setError('У вас нет прав на удаление этого файла');
      } else {
        setError('Ошибка при удалении файла');
      }
      console.error(err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchFiles();
      return;
    }

    try {
      const response = await api.get(`/search/?q=${encodeURIComponent(searchQuery)}`);
      setFiles(response.data.results);
    } catch (err) {
      setError('Ошибка при поиске');
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStorageColor = (percent) => {
    if (percent < 50) return 'success';
    if (percent < 80) return 'warning';
    return 'error';
  };

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 4, mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Мои файлы</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" component={Link} to="/" startIcon={<Folder />}>
              На главную
            </Button>
            <Button variant="outlined" color="error" startIcon={<Logout />} onClick={handleLogout}>
              Выйти
            </Button>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Вы вошли как: <strong>{user?.name || user?.email || 'Пользователь'}</strong>
        </Alert>

        {storageStats && (
          <Card sx={{ mb: 3, backgroundColor: '#f5f5f5' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Storage sx={{ mr: 1, color: '#2196F3' }} />
                <Typography variant="h6">Хранилище</Typography>
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">{storageStats.total_files}</Typography>
                    <Typography variant="body2" color="text.secondary">Всего файлов</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">{formatFileSize(storageStats.total_size)}</Typography>
                    <Typography variant="body2" color="text.secondary">Использовано</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">{formatFileSize(storageStats.available_space)}</Typography>
                    <Typography variant="body2" color="text.secondary">Доступно</Typography>
                  </Box>
                </Grid>
              </Grid>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Использование хранилища</Typography>
                  <Typography variant="body2" fontWeight="bold">{storageStats.usage_percent}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(storageStats.usage_percent, 100)}
                  color={getStorageColor(storageStats.usage_percent)}
                  sx={{ height: 10, borderRadius: 5 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Лимит: {formatFileSize(storageStats.storage_limit)}
                </Typography>
              </Box>

              {storageStats.usage_percent > 80 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <strong>Внимание!</strong> Хранилище заполнено на {storageStats.usage_percent}%. Удалите ненужные файлы.
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>
        )}

        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Поиск файлов..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button variant="outlined" onClick={handleSearch} disabled={!searchQuery.trim()}>
            Найти
          </Button>
          <Button variant="outlined" onClick={fetchFiles} disabled={!searchQuery}>
            Сбросить
          </Button>
          <Button
            variant="contained"
            component="label"
            startIcon={<CloudUpload />}
            disabled={isUploading || (storageStats && storageStats.usage_percent >= 100)}
          >
            {isUploading ? 'Загрузка...' : 'Загрузить файл'}
            <input type="file" hidden onChange={handleFileUpload} disabled={isUploading} />
          </Button>
        </Box>

        {isUploading && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Загрузка на сервер: {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Загруженные файлы ({files.length})
        </Typography>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography>Загрузка...</Typography>
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Folder sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
            <Typography color="text.secondary">
              {searchQuery ? 'Файлы не найдены' : 'У вас пока нет загруженных файлов'}
            </Typography>
          </Box>
        ) : (
          <List>
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
                  secondary={`Загружено: ${formatDate(file.date)}`}
                />
                <Tooltip title="Скачать">
                  <IconButton color="primary" onClick={() => handleDownload(file.id, file.name)}>
                    <Download />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Удалить">
                  <IconButton color="error" onClick={() => handleDelete(file.id, file.name)}>
                    <Delete />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
}

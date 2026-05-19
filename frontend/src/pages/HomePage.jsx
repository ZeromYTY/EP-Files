import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Paper,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Folder,
  Storage,
  TrendingUp,
  Login as LoginIcon,
  PersonAdd,
  Dashboard,
} from '@mui/icons-material';

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [recentFiles, setRecentFiles] = useState([]);
  const [storageStats, setStorageStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRecentFiles();
      fetchStorageStats();
    }
  }, [user]);

  const fetchRecentFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/files/');
      setRecentFiles(response.data.slice(0, 5)); // Последние 5 файлов
    } catch (err) {
      console.error('Ошибка загрузки файлов:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const response = await api.get('/storage/stats/');
      setStorageStats(response.data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
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
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Только что';
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Box
        sx={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e0e0e0',
          px: 3,
          py: 2,
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
              <Folder sx={{ fontSize: 40, color: '#2196F3' }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2196F3' }}>
                EP-Files
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {!user ? (
                <>
                  <Button variant="outlined" component={Link} to="/login" startIcon={<LoginIcon />}>
                    Вход
                  </Button>
                  <Button variant="contained" component={Link} to="/register" startIcon={<PersonAdd />}>
                    Регистрация
                  </Button>
                </>
              ) : (
                <>
                  <Chip
                    avatar={<Avatar sx={{ bgcolor: '#2196F3' }}>{user.name?.[0] || user.email?.[0] || 'U'}</Avatar>}
                    label={user.name || user.email}
                    sx={{ px: 1 }}
                  />
                  <Button variant="contained" component={Link} to="/file-manager" startIcon={<Dashboard />}>
                    Мои файлы
                  </Button>
                  <Button variant="outlined" color="error" onClick={handleLogout}>
                    Выйти
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h2" sx={{ fontWeight: 700, mb: 2, color: '#202124' }}>
            {user ? `Добро пожаловать, ${user.name || 'Пользователь'}!` : 'Безопасное хранилище файлов'}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
            {user
              ? 'Управляйте своими файлами быстро и безопасно'
              : 'Загружайте, храните и делитесь файлами с максимальной защитой'}
          </Typography>
          {!user && (
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="contained" size="large" component={Link} to="/register" startIcon={<PersonAdd />}>
                Начать бесплатно
              </Button>
              <Button variant="outlined" size="large" component={Link} to="/login">
                Войти
              </Button>
            </Box>
          )}
        </Box>

        {user && storageStats && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
            <Grid container spacing={3} sx={{ maxWidth: 1200 }}>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <InsertDriveFile sx={{ fontSize: 40, color: '#fff', mr: 2 }} />
                      <Box>
                        <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700 }}>
                          {storageStats.total_files}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Всего файлов
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      {storageStats.recent_files_count} загружено за неделю
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Storage sx={{ fontSize: 40, color: '#fff', mr: 2 }} />
                      <Box>
                        <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700 }}>
                          {formatFileSize(storageStats.total_size)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Использовано
                        </Typography>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={storageStats.usage_percent}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        '& .MuiLinearProgress-bar': { backgroundColor: '#fff' },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, display: 'block' }}>
                      {storageStats.usage_percent}% из {formatFileSize(storageStats.storage_limit)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <TrendingUp sx={{ fontSize: 40, color: '#fff', mr: 2 }} />
                      <Box>
                        <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700 }}>
                          {formatFileSize(storageStats.available_space)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Доступно
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="contained"
                      fullWidth
                      component={Link}
                      to="/files"
                      sx={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: '#fff',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
                      }}
                    >
                      Загрузить файлы
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
        {user && recentFiles.length > 0 && (
          <Paper sx={{ p: 3, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Недавние файлы
              </Typography>
              <Button component={Link} to="/files" endIcon={<Dashboard />}>
                Все файлы
              </Button>
            </Box>
            <List>
              {recentFiles.map((file, index) => (
                <Box key={file.id}>
                  <ListItem
                    sx={{
                      '&:hover': { backgroundColor: '#f5f5f5', cursor: 'pointer' },
                      borderRadius: 1,
                    }}
                    onClick={() => navigate('/files')}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#2196F3' }}>
                        <InsertDriveFile />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={file.name}
                      secondary={`${formatFileSize(file.size)} • ${formatDate(file.date)}`}
                    />
                    <Chip label={formatDate(file.date)} size="small" />
                  </ListItem>
                  {index < recentFiles.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </Paper>
        )}
        {!user && (
          <Paper
            sx={{
              p: 6,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
              Готовы начать?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
              Создайте аккаунт за 30 секунд и получите 100 MB бесплатно
            </Typography>
            <Button
              variant="contained"
              size="large"
              component={Link}
              to="/register"
              sx={{
                backgroundColor: '#fff',
                color: '#667eea',
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              Создать аккаунт бесплатно
            </Button>
          </Paper>
        )}

        {user && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Быстрые действия
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/file-manager"
                startIcon={<CloudUpload />}
                sx={{ px: 4 }}
              >
                Загрузить файл
              </Button>
              <Button
                variant="outlined"
                size="large"
                component={Link}
                to="/file-manager"
                startIcon={<Folder />}
                sx={{ px: 4 }}
              >
                Мои файлы
              </Button>
            </Box>
          </Paper>
        )}
      </Container>
      <Box sx={{ backgroundColor: '#202124', color: '#fff', py: 4, mt: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                EP-Files
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Безопасное облачное хранилище для ваших файлов. Загружайте, храните и управляйте документами с
                максимальной защитой.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                © 2026 EP-Files. Все права защищены.
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                Сделано с ❤️ для безопасного хранения файлов
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}

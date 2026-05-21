import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  Container,
  Paper,
  Typography,
  Box,
  Alert,
  Avatar,
  Grid,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Folder,
  Logout,
  Email,
  Storage,
  Shield,
  Star,
  Description,
  Download as DownloadIcon,
  ArrowDropUp,
  ArrowDropDown,
  Close,
  CheckCircle
} from '@mui/icons-material';


export default function Files() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = Boolean(user?.is_staff || user?.is_superuser);
  const displayName = user?.name || user?.email || 'Пользователь';

  const [error, setError] = useState('');
  const [storageStats, setStorageStats] = useState(null);
  const [favorites, setFavorites] = useState([]);

  // Система тасок для виджета скачивания прямо в профиле
  const [tasks, setTasks] = useState([]);
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);

  const fetchProfileData = async () => {
    try {
      const [statsRes, favsRes] = await Promise.all([
        api.get('/storage/stats/'),
        api.get('/favorites/all/')
      ]);
      setStorageStats(statsRes.data);
      setFavorites(favsRes.data.items || []);
      setError('');
    } catch (err) {
      console.error('Ошибка при загрузке профиля:', err);
      setStorageStats({
        total_size: 0,
        available_space: 1024 * 1024 * 1024,
        storage_limit: 1024 * 1024 * 1024,
        usage_percent: 0,
      });
      setError('Не удалось загрузить актуальный список избранного');
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Функции управления фоновыми задачами виджета
  const addTask = (id, name, title, subText, status, progress = 0) => {
    setTasks(prev => [...prev, { id, name, title, subText, status, progress }]);
  };
  const updateTask = (id, updatedFields) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t));
  };
  const removeTaskWithTimer = (id) => {
    setTimeout(() => { setTasks(prev => prev.filter(t => t.id !== id)); }, 5000);
  };

  // НАША УНИВЕРСАЛЬНАЯ ФУНКЦИЯ СКАЧИВАНИЯ ПРЯМО ИЗ ИЗБРАННОГО
  const handleDownloadFav = async (id, name, type) => {
    const taskId = 'download-fav-' + Date.now() + Math.random().toString(36).substr(2, 4);
    try {
      setIsWidgetMinimized(false);
      const isFolder = type === 'folder';
      const displayName = name || 'archive';

      addTask(
        taskId,
        displayName + (isFolder ? '.zip' : ''),
        isFolder ? 'Архивация и скачивание папки...' : 'Скачивание файла...',
        'Подготовка потока данных',
        'downloading'
      );

      // ИСПРАВЛЕНО: Стучимся строго по рабочим путям, которые мы настроили в urls.py
      const url = isFolder ? `folders/${id}/download/` : `download/${id}/`;
      const response = await api.get(url, { responseType: 'blob' });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', isFolder ? `${displayName}.zip` : displayName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      updateTask(taskId, {
        title: isFolder ? 'Архив успешно скачан' : 'Скачивание завершено',
        subText: 'Сохранено на устройство',
        status: 'success'
      });
    } catch (err) {
      console.error('Ошибка при скачивании из избранного:', err);
      updateTask(taskId, {
        title: 'Ошибка скачивания',
        subText: err.response?.status === 404 ? 'Объект не найден' : 'Нет прав доступа',
        status: 'error'
      });
    }
  };

  const usedSpace = storageStats?.total_size || 0;
  const totalSpace = storageStats?.storage_limit || 1024 * 1024 * 1024;
  const usagePercent = Math.min(
    storageStats?.usage_percent ?? Math.round((usedSpace / totalSpace) * 100),
    100
  );


  return (
    <Container maxWidth="md" sx={{ py: 6, position: 'relative' }}>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={4}>
        {/* Левая карточка: Юзер */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', backgroundColor: '#fff' }}>
            <Avatar
              sx={{
                width: 100,
                height: 100,
                bgcolor: '#2196F3',
                fontSize: '2.5rem',
                mx: 'auto',
                mb: 2,
                boxShadow: '0 4px 12px rgba(33, 150, 243, 0.2)'
              }}
            >
              {(user?.name || user?.email || 'U').toUpperCase()}
            </Avatar>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
              {displayName}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                mb: 0.5,
                fontWeight: 700,
                color: isAdmin ? '#dc2626' : '#64748b',
              }}
            >
              {isAdmin ? 'Роль: Администратор' : 'Роль: Пользователь'}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {isAdmin ? 'Личный кабинет администратора ep-files' : 'Личный кабинет ep-files'}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate('/file-manager')}
                startIcon={<Folder />}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, py: 1 }}
              >
                В файловый менеджер
              </Button>

              {isAdmin && (
                <Button
                  variant="contained"
                  color="warning"
                  fullWidth
                  onClick={() => navigate('/admin')}
                  startIcon={<Shield />}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, py: 1 }}
                >
                  Войти в админ-панель
                </Button>
              )}

              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={handleLogout}
                startIcon={<Logout />}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, py: 1 }}
              >
                Выйти из аккаунта
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Правая карточка: Статистика */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 3 }}>
              Данные учетной записи
            </Typography>

            <List disablePadding>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon><Email sx={{ color: '#64748b' }} /></ListItemIcon>
                <ListItemText
                  primary={<Typography variant="caption" color="text.secondary">Электронная почта</Typography>}
                  secondary={<Typography variant="body1" sx={{ fontWeight: 500, color: '#1e293b' }}>{user?.email || '—'}</Typography>}
                />
              </ListItem>

              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon><Shield sx={{ color: '#64748b' }} /></ListItemIcon>
                <ListItemText
                  primary={<Typography variant="caption" color="text.secondary">Статус безопасности</Typography>}
                  secondary={<Typography variant="body1" sx={{ fontWeight: 500, color: '#16a34a' }}>Авторизован (JWT Токен)</Typography>}
                />
              </ListItem>

              <ListItem sx={{ px: 0, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'start' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}><Storage sx={{ color: '#64748b' }} /></ListItemIcon>
                  <Typography variant="caption" color="text.secondary">Облачное хранилище</Typography>
                </Box>
                <Box sx={{ width: '100%', pl: 5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      Занято {formatFileSize(usedSpace)} из {formatFileSize(totalSpace)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2196F3' }}>
                      {usagePercent}%
                    </Typography>
                  </Box>
                  <Box sx={{ width: '100%', height: 8, bgcolor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <Box sx={{ width: `${usagePercent}%`, height: '100%', bgcolor: usagePercent > 85 ? '#ef4444' : '#2196F3', borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </Box>
                </Box>
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* СЕКЦИЯ ИЗБРАННОГО С КНОПКАМИ БЫСТРОГО СКАЧИВАНИЯ */}
      <Box sx={{ mt: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Star sx={{ color: '#FFC107', fontSize: '1.8rem' }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
            Избранные объекты
          </Typography>
        </Box>

        {favorites.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
            <Typography variant="body1" color="text.secondary">
              У вас пока нет избранных файлов. Добавьте их в Файловом менеджере.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {favorites.map((item) => (
              <Grid item xs={12} sm={6} key={`${item.type}-${item.id}`}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#fff',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#2196F3', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }
                  }}
                >
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {item.type === 'folder'
                        ? <Folder sx={{ fontSize: 32, color: '#FF9800' }} />
                        : <Description sx={{ fontSize: 32, color: '#2196F3' }} />
                      }
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }} noWrap>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.type === 'folder' ? 'Папка' : formatFileSize(item.size)}
                      </Typography>
                    </Box>

                    {/* ЗАМЕНИЛИ СТРЕЛОЧКУ НА ПРЯМОЕ БЫСТРОЕ СКАЧИВАНИЕ */}
                    <Tooltip title={item.type === 'folder' ? "Скачать как ZIP-архив" : "Скачать файл"}>
                      <IconButton
                        size="small"
                        onClick={() => handleDownloadFav(item.id, item.name, item.type)}
                        sx={{ color: '#2196F3', backgroundColor: 'rgba(33, 150, 243, 0.04)', '&:hover': { backgroundColor: 'rgba(33, 150, 243, 0.1)' } }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* ВСПЛЫВАЮЩИЙ ВИДЖЕТ ФОНОВЫХ ОПЕРАЦИЙ ДЛЯ СКАЧИВАНИЯ ИЗ ПРОФИЛЯ */}
      {tasks.length > 0 && (
        <Paper elevation={4} sx={{ position: 'fixed', bottom: 24, right: 24, width: 360, backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,0.16)', zIndex: 2000, overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Выполняется скачиваний: {tasks.filter(t => t.status === 'downloading').length}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton size="small" sx={{ color: '#64748b' }} onClick={() => setIsWidgetMinimized(!isWidgetMinimized)}>{isWidgetMinimized ? <ArrowDropUp /> : <ArrowDropDown />}</IconButton>
              <IconButton size="small" sx={{ color: '#64748b' }} onClick={() => setTasks([])}><Close fontSize="small" /></IconButton>
            </Box>
          </Box>
          {!isWidgetMinimized && (
            <Box sx={{ overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1, backgroundColor: '#ffffff', maxHeight: 300 }}>
              {tasks.map((task) => (
                <Box key={task.id} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: '8px', border: '1px solid #f1f5f9', backgroundColor: task.status === 'success' ? '#f0fdf4' : task.status === 'error' ? '#fef2f2' : '#ffffff' }}>
                  {task.status === 'downloading' ? (
                    <CircularProgress size={24} thickness={4.5} sx={{ color: '#2196F3', flexShrink: 0 }} />
                  ) : task.status === 'success' ? (
                    <CheckCircle sx={{ color: '#16a34a', fontSize: 24, flexShrink: 0 }} />
                  ) : (
                    <Box sx={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '0.8rem' }}>⚠️</Box>
                  )}
                  <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.name}</Typography>
                    <Typography variant="caption" sx={{ color: task.status === 'success' ? '#16a34a' : task.status === 'error' ? '#ef4444' : '#64748b', display: 'block' }}>{task.subText}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
}
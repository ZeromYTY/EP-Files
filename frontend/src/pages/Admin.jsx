import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Button, 
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import { Block, DeleteForever, CheckCircleOutline, AdminPanelSettings, Equalizer, People, Link } from '@mui/icons-material';

export default function Admin() {
  // Динамические состояния для реальных данных
  const [stats, setStats] = useState({ totalVolume: "0 KB", activeUsers: 0, publicLinks: 0 });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Функция загрузки данных с бэкенда
  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        
        // ВАЖНО: Замените эти URL на реальные эндпоинты вашего Django API, когда они будут готовы
        // const statsResponse = await fetch('/api/admin/stats/');
        // const usersResponse = await fetch('/api/admin/users/');
        // const statsData = await statsResponse.json();
        // const usersData = await usersResponse.json();
        // setStats(statsData);
        // setUsers(usersData);

        setError(null);
      } catch (err) {
        console.error("Ошибка загрузки данных админки:", err);
        setError("Не удалось загрузить данные с сервера.");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  // Обработчик блокировки (отправка запроса на бэк)
  const toggleBlockUser = async (id, login, currentStatus) => {
    try {
      // Пример запроса к бэку:
      // await fetch(`/api/admin/users/${id}/toggle-block/`, { method: 'POST' });
      
      // Локально обновляем интерфейс после успешного запроса:
      setUsers(users.map(u => u.id === id ? { ...u, isBlocked: !u.isBlocked } : u));
      console.log(`[ADMIN] Изменен статус блокировки для ${login}`);
    } catch (err) {
      alert("Ошибка при изменении статуса пользователя");
    }
  };

  // Обработчик удаления файлов пользователя
  const handleDeleteContent = async (id, login) => {
    if (window.confirm(`Вы уверены, что хотите удалить ВСЕ файлы пользователя ${login}?`)) {
      try {
        // Пример запроса к бэку:
        // await fetch(`/api/admin/users/${id}/delete-content/`, { method: 'DELETE' });
        
        setUsers(users.map(u => u.id === id ? { ...u, filesCount: 0 } : u));
        console.log(`[ADMIN] Удален контент пользователя ${login}`);
      } catch (err) {
        alert("Ошибка при удалении контента");
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Alert 
        severity="error" 
        icon={<AdminPanelSettings fontSize="inherit" />}
        sx={{ mb: 4, fontWeight: 'bold', backgroundColor: '#fff1f0', color: '#ff4d4f', borderLeft: '5px solid #ff4d4f' }}
      >
        РЕЖИМ АДМИНИСТРАТОРА СИСТЕМЫ — Будьте аккуратны с деструктивными действиями.
      </Alert>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3, color: '#2c3e50' }}>
        Панель управления
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Блок статистики */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderTop: '4px solid #2196F3', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" variant="subtitle2" gutterBottom>Общий объём файлов</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196F3' }}>{stats.totalVolume}</Typography>
              </Box>
              <Equalizer sx={{ color: '#2196F3', fontSize: 40, opacity: 0.7 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderTop: '4px solid #4CAF50', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" variant="subtitle2" gutterBottom>Активные пользователи</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#4CAF50' }}>{stats.activeUsers}</Typography>
              </Box>
              <People sx={{ color: '#4CAF50', fontSize: 40, opacity: 0.7 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderTop: '4px solid #FF9800', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" variant="subtitle2" gutterBottom>Публичные ссылки</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#FF9800' }}>{stats.publicLinks}</Typography>
              </Box>
              <Link sx={{ color: '#FF9800', fontSize: 40, opacity: 0.7 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Таблица пользователей */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Список пользователей</Typography>
      <TableContainer component={Paper} sx={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#f5f7fa' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Логин</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Роль</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Кол-во файлов</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Дата регистрации</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Статус</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Пользователи не найдены или API бэкенда ещё не подключен.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow 
                  key={user.id} 
                  sx={{ 
                    backgroundColor: user.isBlocked ? '#fff1f0' : 'inherit',
                    '&:hover': { backgroundColor: user.isBlocked ? '#ffe1e0' : '#fcfdfe' }
                  }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{user.login || user.username}</TableCell>
                  <TableCell>
                    <Chip 
                      label={user.role || 'user'} 
                      color={user.role === 'admin' ? 'secondary' : 'default'} 
                      size="small" 
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell>{user.filesCount || 0}</TableCell>
                  <TableCell>{user.regDate || user.date_joined}</TableCell>
                  <TableCell>
                    {user.isBlocked ? (
                      <Typography variant="body2" sx={{ color: '#ff4d4f', fontWeight: 'bold' }}>Заблокирован</Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#52c41a' }}>Активен</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      size="small"
                      color={user.isBlocked ? "success" : "warning"}
                      startIcon={user.isBlocked ? <CheckCircleOutline /> : <Block />}
                      onClick={() => toggleBlockUser(user.id, user.login, user.isBlocked)}
                      sx={{ mr: 1, textTransform: 'none' }}
                    >
                      {user.isBlocked ? 'Разблокировать' : 'Блокировать'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      startIcon={<DeleteForever />}
                      disabled={!user.filesCount}
                      onClick={() => handleDeleteContent(user.id, user.login)}
                      sx={{ textTransform: 'none' }}
                    >
                      Удалить файлы
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
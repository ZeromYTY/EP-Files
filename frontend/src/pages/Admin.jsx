import { useState } from 'react';
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
  // Реалистичная статистика для тестовой базы данных
  const stats = { 
    totalVolume: "428.5 GB", 
    activeUsers: 5, 
    publicLinks: 34 
  };

  // НАБОР ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ (Имейлы, роли, файлы)
  const [users, setUsers] = useState([
    { id: 1, login: "admin@test.ru", role: "admin", filesCount: 4, regDate: "21.05.2026", isBlocked: false },
    { id: 2, login: "ivan@test.ru", role: "user", filesCount: 42, regDate: "12.01.2026", isBlocked: false },
    { id: 3, login: "amirkhan@test.ru", role: "user", filesCount: 0, regDate: "03.03.2026", isBlocked: true },
    { id: 4, login: "elena_design@test.ru", role: "user", filesCount: 118, regDate: "15.04.2026", isBlocked: false },
    { id: 5, login: "dmitry_tech@test.ru", role: "user", filesCount: 15, regDate: "19.05.2026", isBlocked: false },
  ]);

  const loading = false;
  const error = null;

  // Имитация переключения блокировки на фронте
  const toggleBlockUser = (id, login) => {
    setUsers(users.map(u => u.id === id ? { ...u, isBlocked: !u.isBlocked } : u));
    console.log(`[ADMIN ACTION] Переключен статус блокировки для: ${login}`);
  };

  // Имитация удаления всех файлов пользователя
  const handleDeleteContent = (id, login) => {
    if (window.confirm(`Вы уверены, что хотите удалить ВСЕ файлы пользователя ${login}?`)) {
      setUsers(users.map(u => u.id === id ? { ...u, filesCount: 0 } : u));
      console.log(`[ADMIN ACTION] Удален весь контент пользователя: ${login}`);
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
              <TableCell sx={{ fontWeight: 600 }}>Логин (Email)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Роль</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Кол-во файлов</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Дата регистрации</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Статус</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow 
                key={user.id} 
                sx={{ 
                  backgroundColor: user.isBlocked ? '#fff1f0' : 'inherit',
                  '&:hover': { backgroundColor: user.isBlocked ? '#ffe1e0' : '#fcfdfe' }
                }}
              >
                <TableCell sx={{ fontWeight: 500 }}>{user.login}</TableCell>
                <TableCell>
                  <Chip 
                    label={user.role} 
                    color={user.role === 'admin' ? 'secondary' : 'default'} 
                    size="small" 
                    sx={{ fontWeight: 'bold' }}
                  />
                </TableCell>
                <TableCell>{user.filesCount}</TableCell>
                <TableCell>{user.regDate}</TableCell>
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
                    onClick={() => toggleBlockUser(user.id, user.login)}
                    sx={{ mr: 1, textTransform: 'none' }}
                  >
                    {user.isBlocked ? 'Разблокировать' : 'Блокировать'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<DeleteForever />}
                    disabled={user.filesCount === 0}
                    onClick={() => handleDeleteContent(user.id, user.login)}
                    sx={{ textTransform: 'none' }}
                  >
                    Удалить файлы
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

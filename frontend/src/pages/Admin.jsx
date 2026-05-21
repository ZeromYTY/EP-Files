import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Block,
  CheckCircleOutline,
  DeleteOutline,
  Refresh,
} from '@mui/icons-material';

export default function Admin() {
  const { user: currentUser } = useAuth();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Б';

    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    let size = bytes;
    let index = 0;

    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }

    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
  };

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('ru-RU');
  };

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [statsResponse, usersResponse] = await Promise.all([
        api.get('/admin/stats/'),
        api.get('/admin/users/'),
      ]);

      setStats(statsResponse.data);
      setUsers(usersResponse.data.users || []);
    } catch (err) {
      console.error('Ошибка загрузки админ-панели:', err);
      setError('Не удалось загрузить реальные данные админ-панели');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const toggleBlockUser = async (targetUser) => {
    const action = targetUser.is_active ? 'block' : 'unblock';

    try {
      setActionLoading(`${action}-${targetUser.id}`);
      setError('');
      setSuccess('');

      await api.patch(`/admin/users/${targetUser.id}/${action}/`);

      setSuccess(
        targetUser.is_active
          ? `Пользователь ${targetUser.email} заблокирован`
          : `Пользователь ${targetUser.email} разблокирован`
      );

      await fetchAdminData();
    } catch (err) {
      console.error('Ошибка изменения статуса пользователя:', err);
      setError('Не удалось изменить статус пользователя');
    } finally {
      setActionLoading('');
    }
  };

  const deleteUserFiles = async (targetUser) => {
    if (targetUser.file_count === 0) return;

    const confirmed = window.confirm(
      `Удалить все файлы пользователя ${targetUser.email}? Аккаунт останется.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`delete-files-${targetUser.id}`);
      setError('');
      setSuccess('');

      const response = await api.delete(
        `/admin/users/${targetUser.id}/files/delete/`
      );

      setSuccess(
        `Удалено файлов: ${response.data.files_deleted} у пользователя ${targetUser.email}`
      );

      await fetchAdminData();
    } catch (err) {
      console.error('Ошибка удаления файлов пользователя:', err);
      setError('Не удалось удалить файлы пользователя');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0f172a',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Alert severity="warning" sx={{ mb: 3 }}>
        РЕЖИМ АДМИНИСТРАТОРА СИСТЕМЫ — будьте аккуратны с деструктивными действиями.
      </Alert>

      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
        Админ-панель EP Files
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Реальные пользователи, статистика и административные действия
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Typography color="text.secondary">Всего пользователей</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {stats?.total_users ?? 0}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Typography color="text.secondary">Активные пользователи</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {stats?.active_users ?? 0}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Typography color="text.secondary">Всего файлов</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {stats?.total_files ?? 0}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Typography color="text.secondary">Общий объём</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatFileSize(stats?.total_size_bytes)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchAdminData}
        >
          Обновить данные
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Кол-во файлов</TableCell>
              <TableCell>Объём файлов</TableCell>
              <TableCell>Дата регистрации</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {users.map((targetUser) => {
              const isCurrentUser = currentUser?.id === targetUser.id;

              return (
                <TableRow key={targetUser.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {targetUser.email}
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={targetUser.is_staff ? 'admin' : 'user'}
                      color={targetUser.is_staff ? 'secondary' : 'default'}
                    />
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={targetUser.is_active ? 'Активен' : 'Заблокирован'}
                      color={targetUser.is_active ? 'success' : 'error'}
                    />
                  </TableCell>

                  <TableCell>{targetUser.file_count}</TableCell>

                  <TableCell>{formatFileSize(targetUser.total_size)}</TableCell>

                  <TableCell>{formatDate(targetUser.date_joined)}</TableCell>

                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      color={targetUser.is_active ? 'warning' : 'success'}
                      startIcon={
                        targetUser.is_active ? <Block /> : <CheckCircleOutline />
                      }
                      disabled={
                        isCurrentUser ||
                        actionLoading === `block-${targetUser.id}` ||
                        actionLoading === `unblock-${targetUser.id}`
                      }
                      onClick={() => toggleBlockUser(targetUser)}
                      sx={{ mr: 1 }}
                    >
                      {targetUser.is_active ? 'Блокировать' : 'Разблокировать'}
                    </Button>

                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutline />}
                      disabled={
                        targetUser.file_count === 0 ||
                        actionLoading === `delete-files-${targetUser.id}`
                      }
                      onClick={() => deleteUserFiles(targetUser)}
                    >
                      Удалить файлы
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Пользователи не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
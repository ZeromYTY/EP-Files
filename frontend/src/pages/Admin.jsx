import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Container, Grid, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { Block, CheckCircleOutline, DeleteOutline, ExitToApp, Refresh, Save } from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/authContextValue';

function formatFileSize(bytes) {
  if (!bytes) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}

function StatCard({ label, value }) {
  return <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2, borderRadius: 3 }}><Typography color="text.secondary">{label}</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography></Paper></Grid>;
}

function StatsGrid({ stats }) {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <StatCard label="Всего пользователей" value={stats?.total_users ?? 0} />
      <StatCard label="Активные пользователи" value={stats?.active_users ?? 0} />
      <StatCard label="Всего файлов" value={stats?.total_files ?? 0} />
      <StatCard label="Общий объём" value={formatFileSize(stats?.total_size_bytes)} />
    </Grid>
  );
}

function limitBytesToMb(bytes) {
  return Math.round((bytes || 0) / (1024 * 1024));
}

function UserRow({ targetUser, currentUser, actionLoading, limitValue, maxStorageLimitMb, onLimitChange, onSaveLimit, onToggleBlock, onDeleteFiles }) {
  const isCurrentUser = currentUser?.id === targetUser.id;
  const currentLimitMb = limitBytesToMb(targetUser.storage_limit);
  const displayedLimit = limitValue ?? String(currentLimitMb);
  const hasLimitChanges = String(displayedLimit) !== String(currentLimitMb);
  return (
    <TableRow hover>
      <TableCell sx={{ fontWeight: 600 }}>{targetUser.email}</TableCell>
      <TableCell><Chip size="small" label={targetUser.is_staff ? 'admin' : 'user'} color={targetUser.is_staff ? 'secondary' : 'default'} /></TableCell>
      <TableCell><Chip size="small" label={targetUser.is_active ? 'Активен' : 'Заблокирован'} color={targetUser.is_active ? 'success' : 'error'} /></TableCell>
      <TableCell>{targetUser.file_count}</TableCell>
      <TableCell>{formatFileSize(targetUser.total_size)}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 270 }}>
          <TextField size="small" type="number" value={displayedLimit} onChange={(event) => onLimitChange(targetUser.id, event.target.value)} inputProps={{ min: 1, max: maxStorageLimitMb }} InputProps={{ endAdornment: <InputAdornment position="end">МБ</InputAdornment> }} sx={{ width: 132 }} />
          <Tooltip title={hasLimitChanges ? 'Сохранить новый лимит' : 'Лимит не изменён'}>
            <span>
              <Button size="small" variant="outlined" color="primary" startIcon={<Save />} disabled={!hasLimitChanges || actionLoading === `limit-${targetUser.id}`} onClick={() => onSaveLimit(targetUser)} sx={{ height: 40, minWidth: 126 }}>Сохранить</Button>
            </span>
          </Tooltip>
        </Box>
      </TableCell>
      <TableCell>{targetUser.date_joined ? new Date(targetUser.date_joined).toLocaleDateString('ru-RU') : '-'}</TableCell>
      <TableCell align="right">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.75, minWidth: 160 }}>
          <Button size="small" variant="outlined" color={targetUser.is_active ? 'warning' : 'success'} startIcon={targetUser.is_active ? <Block /> : <CheckCircleOutline />} disabled={isCurrentUser || actionLoading === `block-${targetUser.id}` || actionLoading === `unblock-${targetUser.id}`} onClick={() => onToggleBlock(targetUser)}>{targetUser.is_active ? 'Блокировать' : 'Разблокировать'}</Button>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutline />} disabled={targetUser.file_count === 0 || actionLoading === `delete-files-${targetUser.id}`} onClick={() => onDeleteFiles(targetUser)}>Удалить файлы</Button>
        </Box>
      </TableCell>
    </TableRow>
  );
}

function UsersTable({ users, currentUser, actionLoading, limitInputs, maxStorageLimitMb, onLimitChange, onSaveLimit, onToggleBlock, onDeleteFiles }) {
  return (
    <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
      <Table>
        <TableHead><TableRow><TableCell>Email</TableCell><TableCell>Роль</TableCell><TableCell>Статус</TableCell><TableCell>Файлы</TableCell><TableCell>Объём</TableCell><TableCell>Лимит</TableCell><TableCell>Дата</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead>
        <TableBody>
          {users.map((targetUser) => <UserRow key={targetUser.id} targetUser={targetUser} currentUser={currentUser} actionLoading={actionLoading} limitValue={limitInputs[targetUser.id]} maxStorageLimitMb={maxStorageLimitMb} onLimitChange={onLimitChange} onSaveLimit={onSaveLimit} onToggleBlock={onToggleBlock} onDeleteFiles={onDeleteFiles} />)}
          {users.length === 0 && <TableRow><TableCell colSpan={8} align="center">Пользователи не найдены</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function Admin() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [limitInputs, setLimitInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const [statsResponse, usersResponse] = await Promise.all([api.get('/admin/stats/'), api.get('/admin/users/')]);
      const nextUsers = usersResponse.data.users || [];
      setStats(statsResponse.data); setUsers(nextUsers);
      setLimitInputs(Object.fromEntries(nextUsers.map((targetUser) => [targetUser.id, String(limitBytesToMb(targetUser.storage_limit))])));
    } catch (err) {
      console.error('Ошибка загрузки админ-панели:', err); setError('Не удалось загрузить реальные данные админ-панели');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchAdminData(); }, [fetchAdminData]);

  const runUserAction = async (targetUser, action, request) => {
    try {
      setActionLoading(`${action}-${targetUser.id}`); setError(''); setSuccess('');
      const response = await request();
      if (action === 'delete-files') {
        setSuccess(`Удалено файлов: ${response.data.files_deleted} у пользователя ${targetUser.email}`);
      } else if (action === 'limit') {
        setSuccess(`Лимит пользователя ${targetUser.email} сохранён`);
      } else {
        setSuccess(`Статус пользователя ${targetUser.email} изменён`);
      }
      await fetchAdminData();
    } catch (err) {
      const serverMessage = err.response?.data?.error || err.response?.data?.detail;
      console.error('Ошибка действия администратора:', err); setError(serverMessage || 'Не удалось выполнить действие');
    } finally {
      setActionLoading('');
    }
  };

  const handleLimitChange = (userId, value) => {
    setLimitInputs((current) => ({ ...current, [userId]: value }));
  };

  const handleSaveLimit = (targetUser) => {
    const storageLimitMb = Number(limitInputs[targetUser.id]);
    const maxStorageLimitMb = stats?.max_storage_limit_mb ?? 2048;
    if (!Number.isInteger(storageLimitMb) || storageLimitMb < 1) {
      setError('Лимит должен быть целым числом больше 0');
      return;
    }
    if (storageLimitMb > maxStorageLimitMb) {
      setError(`Лимит не может быть больше ${maxStorageLimitMb} МБ`);
      return;
    }
    runUserAction(
      targetUser,
      'limit',
      () => api.patch(`/admin/users/${targetUser.id}/storage-limit/`, { storage_limit_mb: storageLimitMb }),
    );
  };

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0f172a' }}><CircularProgress /></Box>;
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Alert severity="warning" sx={{ mb: 3 }}>РЕЖИМ АДМИНИСТРАТОРА СИСТЕМЫ - будьте аккуратны с деструктивными действиями.</Alert>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Админ-панель EP Files</Typography>
        <Button variant="outlined" startIcon={<ExitToApp />} onClick={() => navigate('/files')}>Выйти из админки</Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>Реальные пользователи, статистика и административные действия</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      <StatsGrid stats={stats} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}><Button variant="outlined" startIcon={<Refresh />} onClick={fetchAdminData}>Обновить данные</Button></Box>
      <UsersTable users={users} currentUser={currentUser} actionLoading={actionLoading} limitInputs={limitInputs} maxStorageLimitMb={stats?.max_storage_limit_mb ?? 2048} onLimitChange={handleLimitChange} onSaveLimit={handleSaveLimit} onToggleBlock={(targetUser) => runUserAction(targetUser, targetUser.is_active ? 'block' : 'unblock', () => api.patch(`/admin/users/${targetUser.id}/${targetUser.is_active ? 'block' : 'unblock'}/`))} onDeleteFiles={(targetUser) => targetUser.file_count > 0 && window.confirm(`Удалить все файлы пользователя ${targetUser.email}?`) && runUserAction(targetUser, 'delete-files', () => api.delete(`/admin/users/${targetUser.id}/files/delete/`))} />
    </Container>
  );
}

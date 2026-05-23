import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, Button, CircularProgress, Container, Grid, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { CheckCircle, Close, Description, Download as DownloadIcon, Folder, Image, Logout, Movie, MusicNote, PictureAsPdf, Shield, Star, Storage, TableChart, Visibility } from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/authContextValue';

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Б';
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${parseFloat((bytes / (1024 ** index)).toFixed(1))} ${sizes[index]}`;
}

const fileGroups = [
  { extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'], icon: Image, color: '#059669', bg: '#ECFDF5' },
  { extensions: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mpeg', 'mpg', 'avi'], icon: Movie, color: '#EA580C', bg: '#FFF7ED' },
  { extensions: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'], icon: MusicNote, color: '#4F46E5', bg: '#eef2ff' },
  { extensions: ['pdf'], icon: PictureAsPdf, color: '#DC2626', bg: '#FEF2F2' },
  { extensions: ['xlsx', 'xls', 'csv'], icon: TableChart, color: '#16A34A', bg: '#F0FDF4' },
];

function getExtension(item) {
  return item?.name?.split('.')?.pop()?.toLowerCase() || '';
}

function canPreview(item) {
  return item?.type === 'file';
}

function FavoriteFileIcon({ item, size = 48 }) {
  const group = item.type === 'folder'
    ? { icon: Folder, color: '#F59E0B', bg: '#FFFBEB' }
    : fileGroups.find((fileGroup) => fileGroup.extensions.includes(getExtension(item)));
  const Icon = group?.icon || Description;
  const bg = group?.bg || '#EFF6FF';
  const color = group?.color || '#2563EB';
  return (
    <Box sx={{ width: size, height: size, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: bg }}>
      <Icon sx={{ fontSize: Math.round(size * 0.7), color }} />
    </Box>
  );
}

function FavoriteMeta({ item }) {
  if (item.type === 'folder') return 'Папка';
  const extension = getExtension(item);
  const label = extension ? extension.toUpperCase() : 'Файл';
  return `${label} · ${formatFileSize(item.size)}`;
}

function ProfileCard({ user, isAdmin, displayName, onFiles, onAdmin, onLogout }) {
  return (
    <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', backgroundColor: '#fff' }}>
      <Avatar sx={{ width: 100, height: 100, bgcolor: '#2196F3', fontSize: '2.5rem', mx: 'auto', mb: 2 }}>{(user?.name || user?.email || 'U').toUpperCase()}</Avatar>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>{displayName}</Typography>
      <Typography variant="body2" sx={{ mb: 3, fontWeight: 700, color: isAdmin ? '#dc2626' : '#64748b' }}>{isAdmin ? 'Роль: Администратор' : 'Роль: Пользователь'}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button variant="contained" fullWidth onClick={onFiles} startIcon={<Folder />}>В файловый менеджер</Button>
        {isAdmin && <Button variant="contained" color="warning" fullWidth onClick={onAdmin} startIcon={<Shield />}>Войти в админ-панель</Button>}
        <Button variant="outlined" color="error" fullWidth onClick={onLogout} startIcon={<Logout />}>Выйти из аккаунта</Button>
      </Box>
    </Paper>
  );
}

function StatsCard({ user, stats }) {
  const used = stats?.total_size || 0;
  const total = stats?.storage_limit || 1024 * 1024 * 1024;
  const percent = Math.min(stats?.usage_percent ?? Math.round((used / total) * 100), 100);
  return (
    <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff', height: '100%' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 3 }}>Данные учетной записи</Typography>
      <Typography variant="body2" color="text.secondary">Электронная почта</Typography>
      <Typography variant="body1" sx={{ fontWeight: 500, mb: 3 }}>{user?.email || '-'}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><Storage sx={{ color: '#64748b' }} /><Typography variant="body2">Занято {formatFileSize(used)} из {formatFileSize(total)}</Typography></Box>
      <Box sx={{ width: '100%', height: 8, bgcolor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}><Box sx={{ width: `${percent}%`, height: '100%', bgcolor: percent > 85 ? '#ef4444' : '#2196F3' }} /></Box>
      <Typography variant="caption" color="text.secondary">{percent}% использовано</Typography>
    </Paper>
  );
}

function FavoriteCard({ item, onDownload, onPreview }) {
  const openPreview = () => {
    if (canPreview(item)) onPreview(item);
  };
  return (
    <Grid item xs={12} sm={6} lg={4}>
      <Paper
        elevation={0}
        onClick={openPreview}
        sx={{
          p: 2,
          minHeight: 104,
          height: '100%',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#fff',
          display: 'grid',
          gridTemplateColumns: '48px minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 1.5,
          cursor: canPreview(item) ? 'pointer' : 'default',
          transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
          '&:hover': {
            borderColor: '#93c5fd',
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
            transform: 'translateY(-1px)',
          },
        }}
      >
        <FavoriteFileIcon item={item} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
            {FavoriteMeta({ item })}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {canPreview(item) && (
            <Tooltip title="Предпросмотр">
              <IconButton size="small" onClick={(event) => { event.stopPropagation(); onPreview(item); }} sx={{ color: '#2563eb' }}>
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={item.type === 'folder' ? 'Скачать как ZIP-архив' : 'Скачать файл'}>
            <IconButton size="small" onClick={(event) => { event.stopPropagation(); onDownload(item.id, item.name, item.type); }} sx={{ color: '#2563eb' }}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    </Grid>
  );
}

function FavoritesSection({ favorites, onDownload, onPreview }) {
  return (
    <Box sx={{ mt: 5 }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: '8px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Star sx={{ color: '#f59e0b', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Избранные объекты</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>{favorites.length} {favorites.length === 1 ? 'объект' : 'объектов'}</Typography>
          </Box>
        </Box>
      </Box>
      {favorites.length === 0 ? <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: '12px', border: '1px solid #e2e8f0' }}><Typography color="text.secondary">У вас пока нет избранных файлов.</Typography></Paper> : (
        <Grid container spacing={2}>{favorites.map((item) => <FavoriteCard key={`${item.type}-${item.id}`} item={item} onDownload={onDownload} onPreview={onPreview} />)}</Grid>
      )}
    </Box>
  );
}

function TaskWidget({ tasks, clearTasks }) {
  if (tasks.length === 0) return null;
  return (
    <Paper elevation={4} sx={{ position: 'fixed', bottom: 24, right: 24, width: 360, borderRadius: '12px', zIndex: 2000, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Скачивания: {tasks.filter((task) => task.status === 'downloading').length}</Typography><IconButton size="small" onClick={clearTasks}><Close fontSize="small" /></IconButton></Box>
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>{tasks.map((task) => <TaskItem key={task.id} task={task} />)}</Box>
    </Paper>
  );
}

function TaskItem({ task }) {
  return (
    <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: '8px', border: '1px solid #f1f5f9' }}>
      {task.status === 'downloading' ? <CircularProgress size={24} /> : <CheckCircle sx={{ color: task.status === 'success' ? '#16a34a' : '#ef4444' }} />}
      <Box sx={{ overflow: 'hidden' }}><Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{task.name}</Typography><Typography variant="caption" color="text.secondary">{task.subText}</Typography></Box>
    </Box>
  );
}

export default function Files({ onPreviewFile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [storageStats, setStorageStats] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    Promise.all([api.get('/storage/stats/'), api.get('/favorites/all/')]).then(([statsRes, favsRes]) => {
      setStorageStats(statsRes.data); setFavorites(favsRes.data.items || []); setError('');
    }).catch(() => setError('Не удалось загрузить актуальный список избранного'));
  }, []);

  const handleDownloadFav = async (id, name, type) => {
    const taskId = `download-fav-${Date.now()}`;
    const isFolder = type === 'folder';
    setTasks((prev) => [...prev, { id: taskId, name: name + (isFolder ? '.zip' : ''), subText: 'Подготовка потока данных', status: 'downloading' }]);
    try {
      const response = await api.get(isFolder ? `folders/${id}/download/` : `download/${id}/`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl; link.setAttribute('download', isFolder ? `${name}.zip` : name); link.click(); window.URL.revokeObjectURL(blobUrl);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, subText: 'Сохранено на устройство', status: 'success' } : task)));
    } catch {
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, subText: 'Нет прав доступа', status: 'error' } : task)));
    }
  };

  const isAdmin = Boolean(user?.is_staff || user?.is_superuser);
  const handleLogout = () => { logout(); navigate('/login'); };
  return (
    <Container maxWidth="lg" sx={{ py: 6, position: 'relative' }}>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
      <Grid container spacing={4}>
        <Grid item xs={12} md={5}><ProfileCard user={user} isAdmin={isAdmin} displayName={user?.name || user?.email || 'Пользователь'} onFiles={() => navigate('/file-manager')} onAdmin={() => navigate('/admin')} onLogout={handleLogout} /></Grid>
        <Grid item xs={12} md={7}><StatsCard user={user} stats={storageStats} /></Grid>
      </Grid>
      <FavoritesSection favorites={favorites} onDownload={handleDownloadFav} onPreview={onPreviewFile} />
      <TaskWidget tasks={tasks} clearTasks={() => setTasks([])} />
    </Container>
  );
}

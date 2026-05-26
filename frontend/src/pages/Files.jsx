import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, Button, CircularProgress, Collapse, Container, Grid, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material';
import { CheckCircle, Close, DarkMode, DeleteOutline, Description, Download as DownloadIcon, ExpandMore, Folder, Image, LightMode, LockReset, Logout, Movie, MusicNote, PhotoCamera, PictureAsPdf, RestoreFromTrash, Shield, Slideshow, Star, Storage, TableChart, Visibility } from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/authContextValue';
import { useThemeMode } from '../themeMode';
import { getApiErrorMessage } from './file-manager/fileManagerHelpers';

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Б';
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${parseFloat((bytes / (1024 ** index)).toFixed(1))} ${sizes[index]}`;
}

const fileGroups = [
  { extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'], icon: Image, color: '#5eead4', bg: 'rgba(94, 234, 212, 0.12)' },
  { extensions: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mpeg', 'mpg', 'avi'], icon: Movie, color: '#fb923c', bg: 'rgba(251, 146, 60, 0.13)' },
  { extensions: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'], icon: MusicNote, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.13)' },
  { extensions: ['pdf'], icon: PictureAsPdf, color: '#fb7185', bg: 'rgba(251, 113, 133, 0.13)' },
  { extensions: ['xlsx', 'xls', 'csv'], icon: TableChart, color: '#4ade80', bg: 'rgba(74, 222, 128, 0.13)' },
  { extensions: ['pptx', 'ppt'], icon: Slideshow, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.13)' },
];

const panelSx = {
  backgroundColor: (theme) => theme.ep.panel,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: (theme) => theme.ep.shadow,
};

function getExtension(item) {
  return item?.name?.split('.')?.pop()?.toLowerCase() || '';
}

function canPreview(item) {
  return item?.type === 'file';
}

function FavoriteFileIcon({ item, size = 48 }) {
  const group = item.type === 'folder'
    ? { icon: Folder, color: '#f4b95f', bg: 'rgba(244, 185, 95, 0.13)' }
    : fileGroups.find((fileGroup) => fileGroup.extensions.includes(getExtension(item)));
  const Icon = group?.icon || Description;
  const bg = group?.bg || 'rgba(68, 215, 182, 0.12)';
  const color = group?.color || '#44d7b6';
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

function ProfileCard({ user, isAdmin, displayName, themeMode, avatarUploading, onAvatarChange, onAvatarDelete, onThemeToggle, onFiles, onTrash, onAdmin, onLogout }) {
  const nextThemeLabel = themeMode === 'dark' ? 'Светлая тема' : 'Темная тема';
  return (
    <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2.5, sm: 4 }, borderRadius: '16px', textAlign: 'center' }}>
      <Box sx={{ position: 'relative', width: { xs: 96, sm: 112 }, height: { xs: 96, sm: 112 }, mx: 'auto', mb: 2 }}>
        <Avatar src={user?.avatar_url || undefined} sx={{ width: { xs: 96, sm: 112 }, height: { xs: 96, sm: 112 }, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: { xs: '2.2rem', sm: '2.6rem' }, fontWeight: 800 }}>{(user?.name || user?.email || 'U')[0]?.toUpperCase()}</Avatar>
        <Tooltip title="Загрузить аватар">
          <IconButton component="label" disabled={avatarUploading} sx={{ position: 'absolute', right: -6, bottom: 6, bgcolor: 'primary.main', color: 'primary.contrastText', border: '2px solid', borderColor: 'background.paper', '&:hover': { bgcolor: 'primary.light' } }} size="small">
            {avatarUploading ? <CircularProgress size={18} color="inherit" /> : <PhotoCamera fontSize="small" />}
            <input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onAvatarChange} />
          </IconButton>
        </Tooltip>
        {user?.avatar_url && (
          <Tooltip title="Удалить аватар">
            <IconButton disabled={avatarUploading} onClick={onAvatarDelete} sx={{ position: 'absolute', left: -6, bottom: 6, bgcolor: 'error.main', color: 'error.contrastText', border: '2px solid', borderColor: 'background.paper', '&:hover': { bgcolor: 'error.dark' } }} size="small">
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5, overflowWrap: 'anywhere' }}>{displayName}</Typography>
      <Typography variant="body2" sx={{ mb: 3, fontWeight: 700, color: isAdmin ? 'warning.main' : 'text.secondary' }}>{isAdmin ? 'Роль: Администратор' : 'Роль: Пользователь'}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button variant="outlined" fullWidth onClick={onThemeToggle} startIcon={themeMode === 'dark' ? <LightMode /> : <DarkMode />}>{nextThemeLabel}</Button>
        <Button variant="contained" fullWidth onClick={onFiles} startIcon={<Folder />}>В файловый менеджер</Button>
        <Button variant="outlined" fullWidth onClick={onTrash} startIcon={<RestoreFromTrash />}>Корзина файлов</Button>
        {isAdmin && <Button variant="contained" color="warning" fullWidth onClick={onAdmin} startIcon={<Shield />}>Войти в админ-панель</Button>}
        <Button variant="outlined" color="error" fullWidth onClick={onLogout} startIcon={<Logout />}>Выйти из аккаунта</Button>
      </Box>
    </Paper>
  );
}

function FilesHeader({ navigate }) {
  return (
    <Box sx={{ minHeight: 73, backgroundColor: (theme) => theme.ep.header, backdropFilter: 'blur(18px)', borderBottom: '1px solid', borderColor: 'divider', px: { xs: 1.5, sm: 2, md: 3 }, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1000 }}>
      <Box component="button" type="button" onClick={() => navigate('/')} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>ep-files</Typography>
      </Box>
    </Box>
  );
}

function StatsCard({ user, stats }) {
  const used = stats?.total_size || 0;
  const total = stats?.storage_limit || 1024 * 1024 * 1024;
  const percent = Math.min(stats?.usage_percent ?? Math.round((used / total) * 100), 100);
  return (
    <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2.5, sm: 4 }, borderRadius: '16px', height: '100%' }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', mb: 3 }}>Данные учетной записи</Typography>
      <Typography variant="body2" color="text.secondary">Электронная почта</Typography>
      <Typography variant="body1" sx={{ fontWeight: 500, mb: 3, overflowWrap: 'anywhere' }}>{user?.email || '-'}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><Storage sx={{ color: 'text.secondary' }} /><Typography variant="body2">Занято {formatFileSize(used)} из {formatFileSize(total)}</Typography></Box>
      <Box sx={{ width: '100%', height: 8, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}><Box sx={{ width: `${percent}%`, height: '100%', bgcolor: percent > 85 ? 'error.main' : 'primary.main' }} /></Box>
      <Typography variant="caption" color="text.secondary">{percent}% использовано</Typography>
    </Paper>
  );
}

function ChangePasswordCard({ form, loading, open, error, onChange, onSubmit, onToggle }) {
  return (
    <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2.5, sm: 4 }, borderRadius: '16px' }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>Смена пароля</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>После изменения понадобится войти заново.</Typography>
        </Box>
        <Button variant={open ? 'outlined' : 'contained'} onClick={onToggle} fullWidth={false} sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, ml: { sm: 'auto' }, minWidth: { sm: 170 }, flexShrink: 0 }} endIcon={<ExpandMore sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />}>
          {open ? 'Скрыть' : 'Сменить пароль'}
        </Button>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2, mt: 3 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField fullWidth label="Текущий пароль" type="password" autoComplete="current-password" value={form.current_password} onChange={(event) => onChange('current_password', event.target.value)} disabled={loading} />
          <TextField fullWidth label="Новый пароль" type="password" autoComplete="new-password" value={form.new_password} onChange={(event) => onChange('new_password', event.target.value)} disabled={loading} />
          <TextField fullWidth label="Повторите новый пароль" type="password" autoComplete="new-password" value={form.confirm_password} onChange={(event) => onChange('confirm_password', event.target.value)} disabled={loading} />
          <Button type="submit" variant="contained" startIcon={loading ? <CircularProgress color="inherit" size={18} /> : <LockReset />} disabled={loading} sx={{ justifySelf: { xs: 'stretch', sm: 'flex-start' } }}>
            Изменить пароль
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
}

function FavoriteCard({ item, onDownload, onPreview }) {
  const openPreview = () => {
    if (canPreview(item)) onPreview(item);
  };
  return (
    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'stretch' } }}>
      <Paper
        elevation={0}
        onClick={openPreview}
        sx={{
          p: 2,
          minHeight: 104,
          height: '100%',
          width: '100%',
          maxWidth: { xs: 360, sm: 'none' },
          borderRadius: '8px',
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: (theme) => theme.ep.panel,
          display: 'grid',
          gridTemplateColumns: { xs: '40px minmax(0, 1fr) auto', sm: '48px minmax(0, 1fr) auto' },
          alignItems: 'center',
          gap: 1.5,
          cursor: canPreview(item) ? 'pointer' : 'default',
          transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: (theme) => theme.ep.shadow,
            transform: 'translateY(-1px)',
          },
        }}
      >
        <FavoriteFileIcon item={item} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {FavoriteMeta({ item })}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {canPreview(item) && (
            <Tooltip title="Предпросмотр">
              <IconButton size="small" onClick={(event) => { event.stopPropagation(); onPreview(item); }} sx={{ color: 'primary.main' }}>
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={item.type === 'folder' ? 'Скачать как ZIP-архив' : 'Скачать файл'}>
            <IconButton size="small" onClick={(event) => { event.stopPropagation(); onDownload(item.id, item.name, item.type); }} sx={{ color: 'primary.main' }}>
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
    <Box sx={{ mt: 5, width: '100%', maxWidth: { xs: 360, sm: 'none' }, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: '8px', backgroundColor: 'rgba(244, 185, 95, 0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Star sx={{ color: 'secondary.main', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>Избранные объекты</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{favorites.length} {favorites.length === 1 ? 'объект' : 'объектов'}</Typography>
          </Box>
        </Box>
      </Box>
      {favorites.length === 0 ? <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: 'center', borderRadius: '12px' }}><Typography color="text.secondary">У вас пока нет избранных файлов.</Typography></Paper> : (
        <Grid container spacing={2} justifyContent={{ xs: 'center', sm: 'flex-start' }}>{favorites.map((item) => <FavoriteCard key={`${item.type}-${item.id}`} item={item} onDownload={onDownload} onPreview={onPreview} />)}</Grid>
      )}
    </Box>
  );
}

function TaskWidget({ tasks, clearTasks }) {
  if (tasks.length === 0) return null;
  return (
    <Paper elevation={4} sx={{ ...panelSx, position: 'fixed', bottom: { xs: 12, sm: 24 }, right: { xs: 12, sm: 24 }, left: { xs: 12, sm: 'auto' }, width: { xs: 'auto', sm: 360 }, borderRadius: '12px', zIndex: 2000, overflow: 'hidden' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Скачивания: {tasks.filter((task) => task.status === 'downloading').length}</Typography><IconButton size="small" onClick={clearTasks}><Close fontSize="small" /></IconButton></Box>
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>{tasks.map((task) => <TaskItem key={task.id} task={task} />)}</Box>
    </Paper>
  );
}

function TaskItem({ task }) {
  return (
    <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: '8px', border: '1px solid', borderColor: 'divider', backgroundColor: (theme) => theme.ep.subtle }}>
      {task.status === 'downloading' ? <CircularProgress size={24} /> : <CheckCircle sx={{ color: task.status === 'success' ? 'success.main' : 'error.main' }} />}
      <Box sx={{ overflow: 'hidden' }}><Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{task.name}</Typography><Typography variant="caption" color="text.secondary">{task.subText}</Typography></Box>
    </Box>
  );
}

export default function Files({ onPreviewFile }) {
  const { user, logout, updateUser } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [storageStats, setStorageStats] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/storage/stats/'), api.get('/favorites/all/')]).then(([statsRes, favsRes]) => {
      setStorageStats(statsRes.data); setFavorites(favsRes.data.items || []); setError('');
    }).catch((err) => setError(getApiErrorMessage(err, 'Не удалось загрузить данные личного кабинета')));
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
  const handleAvatarChange = async (event) => {
    const avatar = event.target.files?.[0];
    event.target.value = '';
    if (!avatar) return;
    const formData = new FormData();
    formData.append('avatar', avatar);
    try {
      setAvatarUploading(true);
      const response = await api.post('/auth/avatar/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser(response.data.user);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить аватар'));
    } finally {
      setAvatarUploading(false);
    }
  };
  const handleAvatarDelete = async () => {
    try {
      setAvatarUploading(true);
      const response = await api.delete('/auth/avatar/');
      updateUser(response.data.user);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось удалить аватар'));
    } finally {
      setAvatarUploading(false);
    }
  };
  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordError('');
  };
  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    try {
      await api.post('/auth/change-password/', passwordForm);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      sessionStorage.setItem('auth_notice', 'Пароль изменен. Войдите с новым паролем.');
      logout();
      navigate('/login');
    } catch (err) {
      const data = err.response?.data;
      const fieldError = data && typeof data === 'object'
        ? Object.values(data).flat().join(' ')
        : '';
      setPasswordError(fieldError || data?.error || data?.detail || 'Не удалось изменить пароль.');
    } finally {
      setPasswordLoading(false);
    }
  };
  return (
    <>
      <FilesHeader navigate={navigate} />
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3 }, position: 'relative' }}>
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        <Grid container spacing={{ xs: 2.5, md: 4 }} justifyContent={{ xs: 'center', md: 'flex-start' }}>
          <Grid item xs={12} md={5} sx={{ maxWidth: { xs: '360px !important', md: 'none' } }}><ProfileCard user={user} isAdmin={isAdmin} displayName={user?.name || user?.email || 'Пользователь'} themeMode={mode} avatarUploading={avatarUploading} onAvatarChange={handleAvatarChange} onAvatarDelete={handleAvatarDelete} onThemeToggle={toggleMode} onFiles={() => navigate('/file-manager')} onTrash={() => navigate('/trash')} onAdmin={() => navigate('/admin')} onLogout={handleLogout} /></Grid>
          <Grid item xs={12} md={7} sx={{ maxWidth: { xs: '360px !important', md: 'none' } }}>
            <Box sx={{ display: 'grid', gap: 3 }}>
              <StatsCard user={user} stats={storageStats} />
              <ChangePasswordCard
                form={passwordForm}
                loading={passwordLoading}
                open={passwordOpen}
                error={passwordError}
                onChange={handlePasswordChange}
                onSubmit={handlePasswordSubmit}
                onToggle={() => setPasswordOpen((prev) => !prev)}
              />
            </Box>
          </Grid>
        </Grid>
        <FavoritesSection favorites={favorites} onDownload={handleDownloadFav} onPreview={onPreviewFile} />
        <TaskWidget tasks={tasks} clearTasks={() => setTasks([])} />
      </Container>
    </>
  );
}

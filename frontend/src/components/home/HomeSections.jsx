import { Link } from 'react-router-dom';
import FilesPageUploader from '../upload/FilesPageUploader';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import {
  CloudUpload,
  Dashboard,
  Folder,
  InsertDriveFile,
  Login as LoginIcon,
  PersonAdd,
  Storage,
  TrendingUp,
} from '@mui/icons-material';

export function HomeHeader({ user, onLogout }) {
  const initials = user?.name?.[0] || user?.email?.[0] || 'U';
  return (
    <Box sx={{ backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', py: 2 }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
            <Folder sx={{ fontSize: 40, color: '#2196F3' }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#2196F3' }}>EP-Files</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!user ? (
              <>
                <Button variant="outlined" component={Link} to="/login" startIcon={<LoginIcon />}>Вход</Button>
                <Button variant="contained" component={Link} to="/register" startIcon={<PersonAdd />}>Регистрация</Button>
              </>
            ) : (
              <>
                <Chip avatar={<Avatar sx={{ bgcolor: '#2196F3' }}>{initials}</Avatar>} label={user.name || user.email} sx={{ px: 1 }} />
                <Button variant="contained" component={Link} to="/file-manager" startIcon={<Dashboard />}>Мои файлы</Button>
                <Button variant="outlined" color="error" onClick={onLogout}>Выйти</Button>
              </>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export function HomeHero({ user }) {
  return (
    <Box sx={{ textAlign: 'center', mb: 6 }}>
      <Typography variant="h2" sx={{ fontWeight: 700, mb: 2, color: '#202124' }}>
        {user ? `Добро пожаловать, ${user.name || 'Пользователь'}!` : 'Безопасное хранилище файлов'}
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
        {user ? 'Управляйте своими файлами быстро и безопасно' : 'Загружайте, храните и делитесь файлами с максимальной защитой'}
      </Typography>
      {!user && (
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="contained" size="large" component={Link} to="/register" startIcon={<PersonAdd />}>Начать бесплатно</Button>
          <Button variant="outlined" size="large" component={Link} to="/login">Войти</Button>
        </Box>
      )}
    </Box>
  );
}

function StorageStatCard({ icon, value, label, caption, children, gradient }) {
  return (
    <Grid item xs={12} md={4}>
      <Card sx={{ height: '100%', background: gradient }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {icon}
            <Box>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700 }}>{value}</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>{label}</Typography>
            </Box>
          </Box>
          {caption && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>{caption}</Typography>}
          {children}
        </CardContent>
      </Card>
    </Grid>
  );
}

export function StorageStatsPanel({ stats, formatFileSize, isUploading, onUploadClick }) {
  if (!stats) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
      <Grid container spacing={3} sx={{ maxWidth: 1200 }}>
        <StorageStatCard icon={<InsertDriveFile sx={{ fontSize: 40, color: '#fff', mr: 2 }} />} value={stats.total_files || 0} label="Всего файлов" caption={`${stats.recent_files_count || 0} загружено за неделю`} gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
        <StorageStatCard icon={<Storage sx={{ fontSize: 40, color: '#fff', mr: 2 }} />} value={formatFileSize(stats.total_size)} label="Использовано" gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
          <LinearProgress variant="determinate" value={stats.usage_percent || 0} sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { backgroundColor: '#fff' } }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, display: 'block' }}>{stats.usage_percent || 0}% из {formatFileSize(stats.storage_limit)}</Typography>
        </StorageStatCard>
        <StorageStatCard icon={<TrendingUp sx={{ fontSize: 40, color: '#fff', mr: 2 }} />} value={formatFileSize(stats.available_space)} label="Доступно" gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
          <Button variant="contained" fullWidth onClick={onUploadClick} startIcon={<CloudUpload />} disabled={isUploading} sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' } }}>Загрузить файлы</Button>
        </StorageStatCard>
      </Grid>
    </Box>
  );
}

function RecentFileItem({ file, index, count, formatFileSize, formatDate, onOpen }) {
  const changedAt = file.updated_at || file.created_at || file.date;
  return (
    <Box>
      <ListItem sx={{ '&:hover': { backgroundColor: '#f5f5f5', cursor: 'pointer' }, borderRadius: 1 }} onClick={onOpen}>
        <ListItemAvatar><Avatar sx={{ bgcolor: '#2196F3' }}><InsertDriveFile /></Avatar></ListItemAvatar>
        <ListItemText primary={file.name} secondary={`${formatFileSize(file.size)} • ${formatDate(changedAt)}`} />
        <Chip label={formatDate(changedAt)} size="small" />
      </ListItem>
      {index < count - 1 && <Divider />}
    </Box>
  );
}

export function RecentFilesPanel({ files, loading, formatFileSize, formatDate, onOpen }) {
  if (!loading && files.length === 0) return null;
  return (
    <Paper sx={{ p: 3, mb: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Недавние файлы</Typography>
        <Button component={Link} to="/file-manager" endIcon={<Dashboard />}>Все файлы</Button>
      </Box>
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><LinearProgress sx={{ width: '100%', maxWidth: 320 }} /></Box> : (
        <List>{files.map((file, index) => <RecentFileItem key={file.id} file={file} index={index} count={files.length} formatFileSize={formatFileSize} formatDate={formatDate} onOpen={onOpen} />)}</List>
      )}
    </Paper>
  );
}

export function GuestCta() {
  return (
    <Paper sx={{ p: 6, textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Готовы начать?</Typography>
      <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>Создайте аккаунт за 30 секунд и получите 100 MB бесплатно</Typography>
      <Button variant="contained" size="large" component={Link} to="/register" sx={{ backgroundColor: '#fff', color: '#667eea', px: 4, py: 1.5, fontSize: '1.1rem', '&:hover': { backgroundColor: '#f5f5f5' } }}>Создать аккаунт бесплатно</Button>
    </Paper>
  );
}

export function QuickActionsPanel({ uploadError, onClearError, onFileDropped, isUploading, uploadProgress, onUploadClick }) {
  return (
    <Paper sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>Быстрые действия</Typography>
      {uploadError && <Alert severity="error" sx={{ mb: 3 }} onClose={onClearError}>{uploadError}</Alert>}
      <FilesPageUploader onFileDropped={onFileDropped} isUploading={isUploading} uploadProgress={uploadProgress} />
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" size="large" onClick={onUploadClick} startIcon={<CloudUpload />} disabled={isUploading} sx={{ px: 4 }}>Загрузить файл</Button>
        <Button variant="outlined" size="large" component={Link} to="/file-manager" startIcon={<Folder />} sx={{ px: 4 }}>Мои файлы</Button>
      </Box>
    </Paper>
  );
}

export function HomeFooter() {
  return (
    <Box sx={{ backgroundColor: '#202124', color: '#fff', py: 4, mt: 6 }}>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>EP-Files</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>Безопасное облачное хранилище для ваших файлов. Загружайте, храните и управляйте документами с максимальной защитой.</Typography>
          </Grid>
          <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>© 2026 EP-Files. Все права защищены.</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>Сделано для безопасного хранения файлов</Typography>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

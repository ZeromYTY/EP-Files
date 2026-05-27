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
  AccountCircle,
  CloudUpload,
  Folder,
  InsertDriveFile,
  Login as LoginIcon,
  PersonAdd,
  Storage,
  TrendingUp,
} from '@mui/icons-material';

const panelSx = {
  backgroundColor: (theme) => theme.ep.panel,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: (theme) => theme.ep.shadow,
};

const homeHeaderButtonSx = {
  minWidth: { xs: 0, sm: 150 },
  height: 40,
  whiteSpace: 'nowrap',
  px: { xs: 1.25, sm: 2 },
  fontSize: { xs: '0.78rem', sm: '0.875rem' },
  '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
};

const quickActionButtonSx = {
  minWidth: { xs: 0, sm: 180 },
  width: { xs: '100%', sm: 'auto' },
  px: { xs: 2, sm: 4 },
};

export function HomeHeader({ user }) {
  return (
    <Box sx={{ backgroundColor: (theme) => theme.ep.header, backdropFilter: 'blur(18px)', borderBottom: '1px solid', borderColor: 'divider', py: 2, position: 'sticky', top: 0, zIndex: 1000 }}>
      <Box sx={{ px: { xs: 1.5, sm: 2, md: 3 }, display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: { xs: 1.25, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>ep-files</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, width: { xs: '100%', sm: 'auto' } }}>
          {!user ? (
            <>
              <Button variant="outlined" component={Link} to="/login" startIcon={<LoginIcon />} sx={{ flex: { xs: 1, sm: 'initial' } }}>Вход</Button>
              <Button variant="contained" component={Link} to="/register" startIcon={<PersonAdd />} sx={{ flex: { xs: 1, sm: 'initial' } }}>Регистрация</Button>
            </>
            ) : (
              <>
                <Button variant="contained" component={Link} to="/file-manager" startIcon={<Folder />} sx={{ ...homeHeaderButtonSx, flex: { xs: 1, sm: 'initial' }, backgroundColor: 'primary.dark', '&:hover': { backgroundColor: 'primary.main' } }}>Мои файлы</Button>
                <Button variant="outlined" component={Link} to="/files" startIcon={<AccountCircle />} sx={{ ...homeHeaderButtonSx, flex: { xs: 1, sm: 'initial' }, backgroundColor: 'rgba(68, 215, 182, 0.08)', '&:hover': { backgroundColor: 'rgba(68, 215, 182, 0.14)' } }}>Личный кабинет</Button>
              </>
            )}
        </Box>
      </Box>
    </Box>
  );
}

export function HomeHero({ user }) {
  return (
    <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 1 }, pt: { xs: 2.5, md: 5 }, pb: 0 }}>
      <Typography variant="h2" sx={{ fontWeight: 900, mb: { xs: 1.25, md: 2 }, color: 'text.primary', fontSize: { xs: '2rem', sm: '2.6rem', md: '3.75rem' }, lineHeight: 1.08 }}>
        {user ? `Добро пожаловать, ${user.name || 'Пользователь'}!` : 'Безопасное хранилище файлов'}
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: { xs: 2, md: 4 }, maxWidth: 680, mx: 'auto', lineHeight: 1.55, fontSize: { xs: '1rem', md: '1.25rem' } }}>
        {user ? 'Управляйте своими файлами быстро и безопасно' : 'Загружайте, храните и делитесь файлами с максимальной защитой'}
      </Typography>
      {!user && (
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button variant="contained" size="large" component={Link} to="/register" startIcon={<PersonAdd />} sx={{ width: { xs: '100%', sm: 'auto' } }}>Начать бесплатно</Button>
          <Button variant="outlined" size="large" component={Link} to="/login" sx={{ width: { xs: '100%', sm: 'auto' } }}>Войти</Button>
        </Box>
      )}
    </Box>
  );
}

function StorageStatCard({ icon, value, label, caption, children, gradient }) {
  return (
    <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
      <Card sx={{ height: '100%', width: '100%', maxWidth: { xs: 360, md: 'none' }, background: gradient, border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 18px 44px rgba(0,0,0,0.34)' }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {icon}
            <Box>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '2rem', sm: '3rem' }, lineHeight: 1.1 }}>{value}</Typography>
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
    <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 3, md: 6 } }}>
      <Grid container spacing={{ xs: 2, md: 3 }} justifyContent="center" sx={{ maxWidth: 1200 }}>
        <StorageStatCard icon={<InsertDriveFile sx={{ fontSize: { xs: 32, sm: 40 }, color: '#fff', mr: 2 }} />} value={stats.total_files || 0} label="Всего файлов" caption={`${stats.recent_files_count || 0} загружено за неделю`} gradient="linear-gradient(135deg, #1d4ed8 0%, #44d7b6 100%)" />
        <StorageStatCard icon={<Storage sx={{ fontSize: { xs: 32, sm: 40 }, color: '#fff', mr: 2 }} />} value={formatFileSize(stats.total_size)} label="Использовано" gradient="linear-gradient(135deg, #7c3aed 0%, #f4b95f 100%)">
          <LinearProgress variant="determinate" value={stats.usage_percent || 0} sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { backgroundColor: '#fff' } }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, display: 'block' }}>{stats.usage_percent || 0}% из {formatFileSize(stats.storage_limit)}</Typography>
        </StorageStatCard>
        <StorageStatCard icon={<TrendingUp sx={{ fontSize: { xs: 32, sm: 40 }, color: '#fff', mr: 2 }} />} value={formatFileSize(stats.available_space)} label="Доступно" gradient="linear-gradient(135deg, #0f766e 0%, #22d3ee 100%)">
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
      <ListItem sx={{ px: { xs: 0.5, sm: 2 }, '&:hover': { backgroundColor: (theme) => theme.ep.hover, cursor: 'pointer' }, borderRadius: 1 }} onClick={onOpen}>
        <ListItemAvatar><Avatar sx={{ bgcolor: 'rgba(68, 215, 182, 0.13)', color: 'primary.main' }}><InsertDriveFile /></Avatar></ListItemAvatar>
        <ListItemText primary={file.name} secondary={`${formatFileSize(file.size)} • ${formatDate(changedAt)}`} primaryTypographyProps={{ noWrap: true }} sx={{ minWidth: 0 }} />
        <Chip label={formatDate(changedAt)} size="small" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
      </ListItem>
      {index < count - 1 && <Divider />}
    </Box>
  );
}

export function RecentFilesPanel({ files, loading, formatFileSize, formatDate, onOpen }) {
  if (!loading && files.length === 0) return null;
  return (
    <Paper sx={{ ...panelSx, p: { xs: 2, sm: 3 }, mb: { xs: 3, md: 6 }, borderRadius: '12px', width: '100%', maxWidth: { xs: 360, sm: 'none' }, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Недавние файлы</Typography>
        <Button component={Link} to="/file-manager" endIcon={<Folder />}>Все файлы</Button>
      </Box>
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><LinearProgress sx={{ width: '100%', maxWidth: 320 }} /></Box> : (
        <List>{files.map((file, index) => <RecentFileItem key={file.id} file={file} index={index} count={files.length} formatFileSize={formatFileSize} formatDate={formatDate} onOpen={onOpen} />)}</List>
      )}
    </Paper>
  );
}

export function GuestCta() {
  return (
    <Paper sx={{ p: { xs: 3, sm: 6 }, textAlign: 'center', background: 'linear-gradient(135deg, #1d4ed8 0%, #44d7b6 100%)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 18px 48px rgba(0,0,0,0.32)', width: '100%', maxWidth: { xs: 360, sm: 'none' }, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1.7rem', sm: '2.125rem' } }}>Готовы начать?</Typography>
      <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, fontSize: { xs: '1rem', sm: '1.25rem' } }}>Создайте аккаунт за 30 секунд и получите 100 MB бесплатно</Typography>
      <Button variant="contained" size="large" component={Link} to="/register" fullWidth sx={{ maxWidth: { sm: 360 }, backgroundColor: '#fff', color: '#0f172a', px: 4, py: 1.5, fontSize: '1.1rem', '&:hover': { backgroundColor: '#ecfeff' } }}>Создать аккаунт бесплатно</Button>
    </Paper>
  );
}

export function QuickActionsPanel({ uploadError, onClearError, onFileDropped, isUploading, uploadProgress, onUploadClick }) {
  return (
    <Paper sx={{ ...panelSx, p: { xs: 2, sm: 4 }, mb: { xs: 3, md: 6 }, textAlign: 'center', borderRadius: '12px', width: '100%', maxWidth: { xs: 360, sm: 'none' }, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>Быстрые действия</Typography>
      {uploadError && <Alert severity="error" sx={{ mb: 3 }} onClose={onClearError}>{uploadError}</Alert>}
      <FilesPageUploader onFileDropped={onFileDropped} isUploading={isUploading} uploadProgress={uploadProgress} />
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" size="large" onClick={onUploadClick} startIcon={<CloudUpload />} disabled={isUploading} sx={quickActionButtonSx}>Загрузить файл</Button>
      </Box>
    </Paper>
  );
}

export function HomeFooter() {
  return (
    <Box sx={{ backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(5, 7, 10, 0.82)' : 'rgba(255,255,255,0.78)'), borderTop: '1px solid', borderColor: 'divider', color: 'text.primary', py: 4, mt: 6 }}>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>ep-files</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>Безопасное облачное хранилище для ваших файлов. Загружайте, храните и управляйте документами с максимальной защитой.</Typography>
          </Grid>
          <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>© 2026 ep-files. Все права защищены.</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>Сделано для безопасного хранения файлов</Typography>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

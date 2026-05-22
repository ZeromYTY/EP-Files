import { Navigate, Outlet, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';

function AdminAccessPage({ title, message, severity = 'info', children }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0f172a',
        p: 3,
      }}
    >
      <Box sx={{ maxWidth: 600, width: '100%' }}>
        <Alert severity={severity} sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            {title}
          </Typography>
          {message}
        </Alert>
        {children}
      </Box>
    </Box>
  );
}

function AdminRoute() {
  const { user, loading } = useAuth();
  const hasStoredToken = Boolean(localStorage.getItem('token'));

  if (!hasStoredToken && !user) {
    return (
      <AdminAccessPage
        title="Войдите в аккаунт"
        message="Для доступа к админ-панели нужно сначала авторизоваться."
        severity="warning"
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" component={RouterLink} to="/login" fullWidth>
            Войти
          </Button>
          <Button variant="outlined" component={RouterLink} to="/register" fullWidth>
            Зарегистрироваться
          </Button>
        </Stack>
      </AdminAccessPage>
    );
  }

  if (loading) {
    return (
      <AdminAccessPage
        title="Проверяем доступ"
        message="Подождите, идет проверка аккаунта."
      >
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
          <CircularProgress size={22} />
          <Typography sx={{ color: '#e2e8f0' }}>Загрузка...</Typography>
        </Stack>
      </AdminAccessPage>
    );
  }

  if (!user) {
    return (
      <AdminAccessPage
        title="Войдите в аккаунт"
        message="Для доступа к админ-панели нужно сначала авторизоваться."
        severity="warning"
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" component={RouterLink} to="/login" fullWidth>
            Войти
          </Button>
          <Button variant="outlined" component={RouterLink} to="/register" fullWidth>
            Зарегистрироваться
          </Button>
        </Stack>
      </AdminAccessPage>
    );
  }

  if (!user.is_staff && !user.is_superuser) {
    return (
      <AdminAccessPage
        title="Доступ запрещён"
        message="Эта страница доступна только администраторам. Ваш аккаунт не имеет прав для открытия панели управления."
        severity="error"
      >
        <Button variant="contained" component={RouterLink} to="/files" fullWidth>
          Вернуться в личный кабинет
        </Button>
      </AdminAccessPage>
    );
  }

  return <Outlet />;
}

export default AdminRoute;

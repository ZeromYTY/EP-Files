import { Navigate, Outlet, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import { Alert, Box, Button, Typography } from '@mui/material';

function AdminRoute() {
  const { user, loading, hasToken } = useAuth();

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Typography color="text.secondary">Загрузка...</Typography>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_staff && !user.is_superuser) {
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
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Доступ запрещен
            </Typography>
            Эта страница доступна только администраторам. У вашего аккаунта нет прав для открытия панели управления.
          </Alert>

          <Button variant="contained" component={RouterLink} to="/files" fullWidth>
            Вернуться в личный кабинет
          </Button>
        </Box>
      </Box>
    );
  }

  return <Outlet />;
}

export default AdminRoute;

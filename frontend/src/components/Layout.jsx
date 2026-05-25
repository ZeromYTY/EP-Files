import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import { AppBar, Box, Button, Container, IconButton, Toolbar, Typography } from '@mui/material';
import { AdminPanelSettings, Folder, Logout, RestoreFromTrash } from '@mui/icons-material';

function Brand() {
  return (
    <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', mr: 3 }}>
      <img src="/logo.png" alt="ep-files logo" style={{ height: 40, width: 'auto', objectFit: 'contain', marginRight: 10 }} />
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem' }}>ep-files</Typography>
    </Box>
  );
}

function GuestNav() {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button color="inherit" component={Link} to="/login" sx={{ fontWeight: 500 }}>Вход</Button>
      <Button color="inherit" component={Link} to="/register" variant="outlined" sx={{ fontWeight: 500, borderColor: '#fff', color: '#fff' }}>Регистрация</Button>
    </Box>
  );
}

function UserNav({ user, onLogout }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem', fontWeight: 500 }}>{user?.name || user?.email}</Typography>
      <Button color="inherit" component={Link} to="/admin" startIcon={<AdminPanelSettings />} sx={{ fontWeight: 600, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>Админка</Button>
      <Button color="inherit" component={Link} to="/files" startIcon={<Folder />} sx={{ fontWeight: 500 }}>Файлы</Button>
      <Button color="inherit" component={Link} to="/trash" startIcon={<RestoreFromTrash />} sx={{ fontWeight: 500 }}>Корзина</Button>
      <IconButton onClick={onLogout} size="small" sx={{ color: '#fff' }} title="Выйти"><Logout /></IconButton>
    </Box>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };
  return (
    <>
      <AppBar position="static" sx={{ background: 'linear-gradient(90deg, #2196F3 0%, #03A9F4 100%)', boxShadow: '0 2px 10px rgba(33, 150, 243, 0.3)' }}>
        <Toolbar><Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}><Brand /></Box>{user ? <UserNav user={user} onLogout={handleLogout} /> : <GuestNav />}</Toolbar>
      </AppBar>
      <Container sx={{ mt: 4, mb: 4 }}><Outlet /></Container>
    </>
  );
}

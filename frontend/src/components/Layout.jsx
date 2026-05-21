import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Container, 
  Box,
  IconButton
} from '@mui/material';
import { Folder, Logout, AdminPanelSettings } from '@mui/icons-material';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <AppBar 
        position="static" 
        sx={{ 
          background: 'linear-gradient(90deg, #2196F3 0%, #03A9F4 100%)',
          boxShadow: '0 2px 10px rgba(33, 150, 243, 0.3)'
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Box 
              component={Link} 
              to="/"
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                textDecoration: 'none',
                mr: 3
              }}
            >
              <img 
                src="/logo.png" 
                alt="ep-files logo" 
                style={{ 
                  height: 40, 
                  width: 'auto',
                  objectFit: 'contain',
                  marginRight: 10
                }} 
              />
              <Typography 
                variant="h6" 
                sx={{ 
                  color: '#fff', 
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  letterSpacing: '0.5px',
                  '&:hover': { opacity: 0.9 }
                }}
              >
                ep-files
              </Typography>
            </Box>
          </Box>
          {!user ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                color="inherit" 
                component={Link} 
                to="/login"
                sx={{ 
                  fontWeight: 500,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Вход
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/register"
                variant="outlined"
                sx={{ 
                  fontWeight: 500,
                  borderColor: '#fff',
                  color: '#fff',
                  '&:hover': { 
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderColor: '#fff'
                  }
                }}
              >
                Регистрация
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography sx={{ 
                color: 'rgba(255,255,255,0.9)', 
                fontSize: '0.95rem',
                fontWeight: 500
              }}>
                {user?.name || user?.email}
              </Typography>

              {/* ВРЕМЕННО ДЛЯ ТЕСТА UI: Показываем кнопку админки всегда */}
              <Button 
                color="inherit" 
                component={Link} 
                to="/admin"
                startIcon={<AdminPanelSettings />}
                sx={{ 
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' }
                }}
              >
                Админка
              </Button>

              <Button 
                color="inherit" 
                component={Link} 
                to="/files"
                startIcon={<Folder />}
                sx={{ 
                  fontWeight: 500,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Файлы
              </Button>
              <IconButton 
                onClick={handleLogout}
                size="small"
                sx={{ 
                  color: '#fff',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                }}
                title="Выйти"
              >
                <Logout />
              </IconButton>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4, mb: 4 }}>
        <Outlet />
      </Container>
    </>
  );
}
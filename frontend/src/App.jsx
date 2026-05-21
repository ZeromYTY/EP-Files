import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import HomePage from './pages/HomePage';
import Files from './pages/Files';
import FileManager from './pages/FileManager';
import Admin from './pages/Admin'; 
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext'; 

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Публичные роуты */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Защищенные роуты для всех авторизованных пользователей */}
      <Route element={<ProtectedRoute />}>
        <Route path="/files" element={<Files />} />
        <Route path="/file-manager" element={<FileManager />} />
        
        {/* Роут админки с автоматической проверкой */}
        {user?.role === 'admin' && (
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
        )}
      </Route>

      {/* Редирект для любых несуществующих страниц */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import HomePage from './pages/HomePage';
import Files from './pages/Files';
import FileManager from './pages/FileManager';
import Admin from './pages/Admin'; 
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Публичные роуты */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Защищенные роуты */}
      <Route element={<ProtectedRoute />}>
        <Route path="/files" element={<Files />} />
        <Route path="/file-manager" element={<FileManager />} />
        
        {/* ВРЕМЕННО ДЛЯ ТЕСТА: Открываем прямой доступ к админке */}
        <Route path="/admin" element={<Admin />} />
      </Route>

      {/* Редирект для любых несуществующих страниц */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
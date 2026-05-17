import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import HomePage from './pages/HomePage';
import Files from './pages/Files';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Публичные страницы */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Защищённые страницы (требуют входа) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/files" element={<Files />} />
      </Route>

      {/* Редирект с неизвестных путей */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
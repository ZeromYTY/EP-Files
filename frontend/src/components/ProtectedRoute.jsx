import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import LoadingScreen from './LoadingScreen';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen label="Проверяем доступ" />;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

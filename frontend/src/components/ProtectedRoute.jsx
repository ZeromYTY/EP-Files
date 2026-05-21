import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

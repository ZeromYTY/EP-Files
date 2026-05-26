import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';

function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_staff && !user.is_superuser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;

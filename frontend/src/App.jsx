import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState } from 'react';

import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoadingScreen from './components/LoadingScreen';
import usePreventBrowserFileDrop from './usePreventBrowserFileDrop';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const HomePage = lazy(() => import('./pages/HomePage'));
const Files = lazy(() => import('./pages/Files'));
const FileManager = lazy(() => import('./pages/FileManager'));
const Admin = lazy(() => import('./pages/Admin'));
const PublicAccess = lazy(() => import('./pages/PublicAccess'));
const Trash = lazy(() => import('./pages/Trash'));
const FilePreviewModal = lazy(() => import('./FilePreviewModal'));

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  usePreventBrowserFileDrop();

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Публичные роуты */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/public/:resourceType/:token" element={<PublicAccess />} />

          {/* Защищенные роуты */}
          <Route element={<ProtectedRoute />}>
            <Route path="/files" element={<Files onPreviewFile={setSelectedFile} />} />
            <Route path="/file-manager" element={<FileManager onPreviewFile={setSelectedFile} />} />
            <Route path="/trash" element={<Trash />} />

            {/* Админка доступна только staff/superuser */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>

          {/* Редирект для любых несуществующих страниц */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {selectedFile && (
        <Suspense fallback={null}>
          <FilePreviewModal
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
          />
        </Suspense>
      )}
    </>
  );
}

export default App;

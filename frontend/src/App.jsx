import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

import Login from './pages/Login';
import Register from './pages/Register';
import HomePage from './pages/HomePage';
import Files from './pages/Files';
import FileManager from './pages/FileManager';
import Admin from './pages/Admin';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import FilePreviewModal from './FilePreviewModal';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <>
      <Routes>
        {/* Публичные роуты */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Защищенные роуты */}
        <Route element={<ProtectedRoute />}>
          <Route path="/files" element={<Files />} />
          <Route path="/file-manager" element={<FileManager onPreviewFile={setSelectedFile} />} />

          {/* Админка доступна только staff/superuser */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>

        {/* Редирект для любых несуществующих страниц */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {selectedFile && (
        <FilePreviewModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </>
  );
}

export default App;

import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

import Login from './pages/Login';
import Register from './pages/Register';
import HomePage from './pages/HomePage';
import Files from './pages/Files';
import FileManager from './pages/FileManager';

import ProtectedRoute from './components/ProtectedRoute';
import FilePreviewModal from './FilePreviewModal';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/files" element={<Files />} />
          <Route path="/file-manager" element={<FileManager onPreviewFile={setSelectedFile} />} />
        </Route>

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
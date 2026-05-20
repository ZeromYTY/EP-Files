import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import HomePage from './pages/HomePage';
import Files from './pages/Files';
import FileManager from './pages/FileManager';
import ProtectedRoute from './components/ProtectedRoute';
import React, { useState } from 'react';
import FilePreviewModal from './FilePreviewModal';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/files" element={<Files />} />
        <Route path="/file-manager" element={<FileManager />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const mockFiles = [
  { id: 1, name: 'design_layout.jpg', size: 245000, type: 'image', url: '/assets/preview-img.jpg' },
  { id: 2, name: 'report_v2.txt', size: 1200, type: 'text', url: '/assets/report.txt' },
  { id: 3, name: 'data_config.json', size: 3500, type: 'text', url: '/assets/config.json' },
];

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Мои файлы</h1>
      
      <div className="grid gap-4 max-w-2xl">
        {mockFiles.map((file) => (
          <div 
            key={file.id}
            onClick={() => setSelectedFile(file)}
            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md cursor-pointer flex justify-between items-center transition-all border border-transparent hover:border-blue-400"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{file.type === 'image' ? '🖼️' : '📄'}</span>
              <div>
                <p className="font-medium text-gray-700">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button className="text-blue-500 text-sm font-semibold">Просмотр</button>
          </div>
        ))}
      </div>

      {/* Компонент попапа */}
      {selectedFile && (
        <FilePreviewModal 
          file={selectedFile} 
          onClose={() => setSelectedFile(null)} 
        />
      )}
    </div>
  );
}
export default App;

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Paper,
  Alert,
} from '@mui/material';
import {
  Search,
  Add,
  ArrowBack,
  Home,
  Person,
  Logout,
  GridView,
  ViewList,
  Folder,
  Upload,
  Description,
  TableChart,
} from '@mui/icons-material';
import Breadcrumbs from '../components/file-manager/Breadcrumbs';
import FileList from '../components/file-manager/FileList';
import EmptyState from '../components/file-manager/EmptyState';
import FileUpload from '../components/upload/FileUpload';

// 📁 Моковые данные (начальное состояние)
const initialFileSystem = {
  '/': [
    { id: 1, name: 'Документы', type: 'folder', size: null, modified: '2026-05-01T10:30:00', parentId: null },
    { id: 2, name: 'Проекты', type: 'folder', size: null, modified: '2026-04-28T14:20:00', parentId: null },
    { id: 3, name: 'Фото', type: 'folder', size: null, modified: '2026-04-25T09:15:00', parentId: null },
    { id: 4, name: 'Резюме.pdf', type: 'file', fileType: 'pdf', size: 245000, modified: '2026-05-01T16:45:00', parentId: null },
    { id: 5, name: 'Отчёт.xlsx', type: 'file', fileType: 'sheet', size: 89000, modified: '2026-04-30T11:30:00', parentId: null },
  ],
  '/Документы': [
    { id: 6, name: 'Договор.docx', type: 'file', fileType: 'doc', size: 45000, modified: '2026-04-29T13:00:00', parentId: 1 },
    { id: 7, name: 'Презентация.pptx', type: 'file', fileType: 'ppt', size: 3500000, modified: '2026-04-27T10:00:00', parentId: 1 },
  ],
  '/Проекты': [
    { id: 8, name: 'ТЗ.txt', type: 'file', fileType: 'doc', size: 12000, modified: '2026-04-26T15:30:00', parentId: 2 },
    { id: 9, name: 'Скриншоты', type: 'folder', size: null, modified: '2026-04-24T09:00:00', parentId: 2 },
  ],
  '/Фото': [],
};

const folderPathMap = {
  null: '/',
  1: '/Документы',
  2: '/Проекты',
  3: '/Фото',
};

export default function FileManager() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [anchorEl, setAnchorEl] = useState(null);
  
  // 🔧 ДОБАВЛЕНО: Состояние для хранения файлов
  const [fileSystem, setFileSystem] = useState(initialFileSystem);
  const [uploadSuccess, setUploadSuccess] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleFolderClick = (folderId) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
  };

  const handleBreadcrumbClick = (folderId) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
  };

  const handleGoHome = () => {
    setCurrentFolderId(null);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (currentFolderId !== null) {
      const allFiles = Object.values(fileSystem).flat();
      const currentFolder = allFiles.find(f => f.id === currentFolderId);
      setCurrentFolderId(currentFolder?.parentId || null);
    }
  };

  const handleCreateClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCreateClose = () => {
    setAnchorEl(null);
  };

  // 🔧 ОБНОВЛЕНО: Добавление загруженного файла в список
  const handleUploadComplete = (uploadedFile) => {
    const currentPath = folderPathMap[currentFolderId] || '/';
    
    const newFile = {
      id: Date.now(), // Уникальный ID
      name: uploadedFile.name,
      type: 'file',
      fileType: getFileTypeFromName(uploadedFile.name),
      size: uploadedFile.size,
      modified: new Date().toISOString(),
      parentId: currentFolderId,
    };
    
    // Обновляем файловую систему
    setFileSystem(prev => ({
      ...prev,
      [currentPath]: [...(prev[currentPath] || []), newFile],
    }));
    
    setUploadSuccess(`Файл "${uploadedFile.name}" загружен!`);
    setTimeout(() => setUploadSuccess(''), 3000);
  };

  // 🔧 ДОБАВЛЕНО: Определение типа файла по расширению
  const getFileTypeFromName = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'pdf';
    if (['xlsx', 'xls'].includes(ext)) return 'sheet';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    if (['ppt', 'pptx'].includes(ext)) return 'ppt';
    return 'doc'; // по умолчанию
  };

  const currentPath = folderPathMap[currentFolderId] || '/';
  
  // 🔧 ИЗМЕНЕНО: Берём файлы из состояния, а не из константы
  const currentFiles = fileSystem[currentPath] || [];

  const filteredFiles = currentFiles.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  const getPathArray = () => {
    const path = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);
    return [{ id: null, name: 'Главная' }, ...path.map((name, index) => {
      const folder = Object.values(fileSystem).flat().find(f => f.name === name && f.type === 'folder');
      return { id: folder?.id || null, name };
    })];
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* 🔵 HEADER */}
      <Box
        sx={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e0e0e0',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        <Box 
          component="a" 
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}
        >
          <img src="/logo.png" alt="ep-files logo" style={{ height: 40, width: 'auto' }} />
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#2196F3', fontSize: '1.5rem' }}>
            ep-files
          </Typography>
        </Box>

        <Box sx={{ flex: 1, maxWidth: 600, mx: 4 }}>
          <TextField
            fullWidth
            placeholder="Поиск файлов..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#9e9e9e' }} />
                </InputAdornment>
              ),
              sx: {
                backgroundColor: '#f1f3f4',
                borderRadius: '8px',
                '& fieldset': { border: 'none' },
              },
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title={user?.email || 'Пользователь'}>
            <IconButton sx={{ backgroundColor: '#2196F3', color: '#fff' }}>
              <Person />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" color="error" size="small" onClick={handleLogout} startIcon={<Logout />}>
            Выйти
          </Button>
        </Box>
      </Box>

      {/* 📁 FILE MANAGER CONTENT */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Уведомление об успешной загрузке */}
        {uploadSuccess && (
          <Alert 
            severity="success" 
            sx={{ mb: 2 }}
            onClose={() => setUploadSuccess('')}
          >
            {uploadSuccess}
          </Alert>
        )}

        {/* Панель навигации */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: '12px', border: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title="Назад">
              <span>
                <IconButton size="small" onClick={handleBack} disabled={currentFolderId === null}
                  sx={{ color: currentFolderId === null ? '#bdbdbd' : '#2196F3' }}>
                  <ArrowBack />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Главная">
              <span>
                <IconButton size="small" onClick={handleGoHome} disabled={currentFolderId === null}
                  sx={{ color: currentFolderId === null ? '#bdbdbd' : '#2196F3' }}>
                  <Home />
                </IconButton>
              </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            <Breadcrumbs path={getPathArray()} onBreadcrumbClick={handleBreadcrumbClick} />

            <Box sx={{ flexGrow: 1 }} />

            <Tooltip title={viewMode === 'list' ? 'Вид: сетка' : 'Вид: список'}>
              <IconButton size="small" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} sx={{ color: '#2196F3' }}>
                {viewMode === 'list' ? <GridView /> : <ViewList />}
              </IconButton>
            </Tooltip>

            <Button variant="contained" startIcon={<Add />} onClick={handleCreateClick}
              sx={{ backgroundColor: '#2196F3', color: '#fff', '&:hover': { backgroundColor: '#1976D2' } }}>
              Создать
            </Button>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCreateClose}
              PaperProps={{ sx: { borderRadius: '8px' } }}>
              <MenuItem onClick={handleCreateClose}><Folder sx={{ color: '#FF9800', mr: 2 }} /> Папка</MenuItem>
              <MenuItem onClick={handleCreateClose}><Description sx={{ color: '#2196F3', mr: 2 }} /> Документ</MenuItem>
              <MenuItem onClick={handleCreateClose}><TableChart sx={{ color: '#4CAF50', mr: 2 }} /> Таблица</MenuItem>
              <Divider />
              <MenuItem onClick={handleCreateClose}><Upload sx={{ color: '#9C27B0', mr: 2 }} /> Загрузить файл</MenuItem>
            </Menu>
          </Box>
        </Paper>

        {/* 📤 Компонент загрузки файлов */}
        <FileUpload 
          onUploadComplete={handleUploadComplete}
          folderId={currentFolderId}
        />

        {/* Заголовок */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#202124' }}>
            {currentPath === '/' ? 'Все файлы' : currentPath.split('/').pop()}
          </Typography>
          <Typography variant="body2" color="text.secondary">{sortedFiles.length} объектов</Typography>
        </Box>

        {/* Список файлов или пустое состояние */}
        {sortedFiles.length === 0 ? (
          <EmptyState folderName={currentPath === '/' ? 'корневой папке' : currentPath.split('/').pop()} />
        ) : (
          <FileList 
            files={sortedFiles} 
            viewMode={viewMode} 
            onFolderClick={handleFolderClick} 
          />
        )}
      </Container>
    </Box>
  );
}
import { useState, useEffect } from 'react';
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
import api from '../api/axios';

const folderPathMap = {
  null: '/',
};

export default function FileManager() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [anchorEl, setAnchorEl] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploadSuccess, setUploadSuccess] = useState('');

  const fetchFiles = async () => {
    try {
      const url = currentFolderId ? `/files/?folder_id=${currentFolderId}` : '/files/';
      const response = await api.get(url);
      setFiles(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [currentFolderId]);

  const handleDownloadFile = async (fileId, fileName) => {
    try {
      const response = await api.get(`/files/${fileId}/download/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Не удалось скачать файл.');
    }
  };

    const handleDeleteFile = async (fileId) => {
    try {
      await api.delete(`/files/${fileId}/`);
      fetchFiles();
      setUploadSuccess('Файл успешно удален');
      setTimeout(() => setUploadSuccess(''), 3000);
    } catch (error) {
      alert('Не удалось удалить файл. Ошибка доступа или сервера.');
    }
  };

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
      const currentFolder = files.find(f => f.id === currentFolderId);
      setCurrentFolderId(currentFolder?.parentId || null);
    }
  };

  const handleCreateClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCreateClose = () => {
    setAnchorEl(null);
  };

  const handleUploadComplete = () => {
    fetchFiles();
    setUploadSuccess(`Файл успешно загружен!`);
    setTimeout(() => setUploadSuccess(''), 3000);
  };

  const currentPath = folderPathMap[currentFolderId] || '/';

  const getPathArray = () => {
    const path = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);
    return [
      { id: null, name: 'Главная' },
      ...path.map((name) => {
        const folder = files?.find(f => f.name === name && f.type === 'folder');
        return { id: folder?.id || null, name };
      })
    ];
  };

  const filteredFiles = (files || []).filter(file =>
    file && file.name && file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
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

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {uploadSuccess && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => setUploadSuccess('')}
          >
            {uploadSuccess}
          </Alert>
        )}

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

        <FileUpload
          onUploadComplete={handleUploadComplete}
          folderId={currentFolderId}
        />

        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#202124' }}>
            {currentPath === '/' ? 'Все файлы' : currentPath.split('/').pop()}
          </Typography>
          <Typography variant="body2" color="text.secondary">{sortedFiles.length} объектов</Typography>
        </Box>

        {sortedFiles.length === 0 ? (
          <EmptyState
            folderName={currentPath === '/' ? 'корневой папке' : currentPath.split('/').pop()}
            onUploadClick={() => document.querySelector('input[type="file"]')?.click()}
          />
        ) : (
          <FileList
              files={sortedFiles}
              viewMode={viewMode}
              onFolderClick={handleFolderClick}
              onDownloadClick={handleDownloadFile}
              onDeleteClick={handleDeleteFile}
              onFileDropped={handleFileUploadFile || fetchFiles}
              isUploading={false}
            />

        )}
      </Container>
    </Box>
  );
}

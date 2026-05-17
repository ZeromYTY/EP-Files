import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
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
  Folder as FolderIcon,
  Upload,
  Description,
  TableChart,
  InsertDriveFile,
  CreateNewFolder,
  MoreVert,
  NavigateNext,
  FolderOpen,
  Delete,
  Edit,
  DriveFileMove,
} from '@mui/icons-material';

import Breadcrumbs from '../components/file-manager/Breadcrumbs';
import FileList from '../components/file-manager/FileList';
import EmptyState from '../components/file-manager/EmptyState';
import FileUpload from '../components/upload/FileUpload';

export default function FileManager() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [anchorEl, setAnchorEl] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadData();
  }, [currentFolderId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [foldersRes, filesRes] = await Promise.all([
        api.get('/folders/'),
        api.get('/files/')
      ]);

      const allFolders = foldersRes.data.folders || [];
      const allFiles = filesRes.data || [];

      const currentFolderData = allFolders.filter(
        f => f.parent_id === currentFolderId
      );
      setFolders(currentFolderData);

      const currentFiles = allFiles.filter(
        f => (currentFolderId ? f.folder === currentFolderId : !f.folder)
      );
      setFiles(currentFiles);

      updateBreadcrumbs(allFolders);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const updateBreadcrumbs = (allFolders) => {
    if (!currentFolderId) {
      setBreadcrumbs([]);
      return;
    }

    const path = [];
    let folderId = currentFolderId;

    while (folderId) {
      const folder = allFolders.find(f => f.id === folderId);
      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parent_id;
    }

    setBreadcrumbs(path);
  };

  const getPathArray = () => {
    return [
      { id: null, name: 'Главная' },
      ...breadcrumbs.map(b => ({ id: b.id, name: b.name }))
    ];
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await api.get(`/download/${fileId}/`, {
        responseType: 'blob'
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
      console.error('Download error:', error);
      alert('Не удалось скачать файл.');
    }
  };

  const handleDownloadFile = async (fileId, fileName) => {
    await handleDownload(fileId, fileName);
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await api.delete(`/files/${fileId}/`);
      setSuccess('Файл успешно удален');
      setTimeout(() => setSuccess(''), 3000);
      loadData();
    } catch (error) {
      alert('Не удалось удалить файл. Ошибка доступа или сервера.');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await api.post('/folders/create/', {
        name: newFolderName,
        parent_id: currentFolderId
      });
      setNewFolderName('');
      setCreateFolderOpen(false);
      loadData();
    } catch (err) {
      console.error('Error creating folder:', err);
      setError('Ошибка создания папки');
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', selectedFile);
    if (currentFolderId) {
      formData.append('folder_id', currentFolderId);
    }

    try {
      await api.post('/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSelectedFile(null);
      setUploadDialogOpen(false);
      setSuccess('Файл успешно загружен');
      loadData();
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.response?.data?.error || 'Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
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
      const currentFolderObj = breadcrumbs.find(f => f.id === currentFolderId);
      setCurrentFolderId(currentFolderObj?.parent_id || null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCreateClose = () => {
    setAnchorEl(null);
  };

  const handleMenuOpen = (event, item, type) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedItem({ ...item, type });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleRename = () => {
    if (!selectedItem) return;
    setNewName(selectedItem.name || '');
    setRenameDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleRenameSubmit = async () => {
    const trimmedName = (newName || '').trim();

    if (!trimmedName) {
      setError('Введите название');
      return;
    }

    if (!selectedItem) {
      setError('Элемент не выбран');
      return;
    }

    setError('');

    try {
      if (selectedItem.type === 'folder') {
        await api.patch(`/folders/${selectedItem.id}/rename/`, {
          name: trimmedName
        });
      } else {
        await api.patch(`/files/${selectedItem.id}/`, {
          name: trimmedName
        });
      }

      setRenameDialogOpen(false);
      setNewName('');
      setSelectedItem(null);
      setSuccess('Успешно переименовано');
      await loadData();
    } catch (err) {
      console.error('Error renaming:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Ошибка переименования';
      setError(errorMsg);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    if (!window.confirm(`Удалить ${selectedItem.type === 'folder' ? 'папку' : 'файл'} "${selectedItem.name}"?`)) {
      setMenuAnchor(null);
      setSelectedItem(null);
      return;
    }

    try {
      if (selectedItem.type === 'folder') {
        await api.delete(`/folders/${selectedItem.id}/delete/`);
      } else {
        await api.delete(`/files/${selectedItem.id}/`);
      }
      setMenuAnchor(null);
      setSelectedItem(null);
      setSuccess('Успешно удалено');
      loadData();
    } catch (err) {
      console.error('Error deleting:', err);
      setError('Ошибка удаления');
    }
  };

  const handleUploadComplete = () => {
    loadData();
    setSuccess('Файл успешно загружен!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredFolders = folders.filter(folder =>
    folder && folder.name && folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = files.filter(file =>
    file && file.name && file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mixedItems = [
    ...filteredFolders.map(f => ({ ...f, type: 'folder' })),
    ...filteredFiles.map(f => ({ ...f, type: 'file' }))
  ];

  const sortedItems = [...mixedItems].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const getCurrentLocationName = () => {
    if (!currentFolderId) return 'Главная';
    const activeFolder = breadcrumbs.find(b => b.id === currentFolderId);
    return activeFolder ? activeFolder.name : 'Папка';
  };

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
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
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
              <MenuItem onClick={() => { handleCreateClose(); setCreateFolderOpen(true); }}><FolderIcon sx={{ color: '#FF9800', mr: 2 }} /> Папка</MenuItem>
              <MenuItem onClick={handleCreateClose}><Description sx={{ color: '#2196F3', mr: 2 }} /> Документ</MenuItem>
              <MenuItem onClick={handleCreateClose}><TableChart sx={{ color: '#4CAF50', mr: 2 }} /> Таблица</MenuItem>
              <Divider />
              <MenuItem onClick={() => { handleCreateClose(); setUploadDialogOpen(true); }}><Upload sx={{ color: '#9C27B0', mr: 2 }} /> Загрузить файл</MenuItem>
            </Menu>
          </Box>
        </Paper>

        <FileUpload
          onUploadComplete={handleUploadComplete}
          folderId={currentFolderId}
        />

        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#202124' }}>
            {getCurrentLocationName()}
          </Typography>
          <Typography variant="body2" color="text.secondary">{sortedItems.length} объектов</Typography>
        </Box>

        {viewMode === 'grid' ? (
          sortedItems.length === 0 ? (
            <EmptyState
              folderName={getCurrentLocationName()}
              onUploadClick={() => setUploadDialogOpen(true)}
            />
          ) : (
            <FileList
              files={sortedItems}
              viewMode={viewMode}
              onFolderClick={handleFolderClick}
              onDownloadClick={handleDownloadFile}
              onDeleteClick={handleDeleteFile}
              onFileDropped={handleUploadComplete}
              isUploading={false}
            />
          )
        ) : (
          folders.length === 0 && files.length === 0 ? (
            <Paper sx={{ p: 8, textAlign: 'center' }}>
              <FolderOpen sx={{ fontSize: 80, color: '#bdbdbd', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Папка пуста
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Создайте папку или загрузите файл, чтобы начать работу
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button variant="outlined" startIcon={<CreateNewFolder />} onClick={() => setCreateFolderOpen(true)}>
                  Создать папку
                </Button>
                <Button variant="contained" startIcon={<Upload />} onClick={() => setUploadDialogOpen(true)}>
                  Загрузить файл
                </Button>
              </Box>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Тип</TableCell>
                    <TableCell>Размер</TableCell>
                    <TableCell>Дата изменения</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {folders.map((folder) => (
                    <TableRow key={`folder-${folder.id}`} hover sx={{ cursor: 'pointer' }} onClick={() => handleFolderClick(folder.id)}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon sx={{ color: '#FFA726' }} />
                          <Typography>{folder.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label="Папка" size="small" color="warning" />
                      </TableCell>
                      <TableCell>{formatFileSize(folder.size || 0)}</TableCell>
                      <TableCell>{formatDate(folder.updated_at || folder.date)}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, folder, 'folder')}>
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {files.map((file) => (
                    <TableRow key={`file-${file.id}`} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InsertDriveFile sx={{ color: '#42A5F5' }} />
                          <Typography>{file.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label="Файл" size="small" color="primary" />
                      </TableCell>
                      <TableCell>{formatFileSize(file.size)}</TableCell>
                      <TableCell>{formatDate(file.date || file.updated_at)}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, file, 'file')}>
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )
        )}
      </Container>

      <Dialog open={createFolderOpen} onClose={() => setCreateFolderOpen(false)}>
        <DialogTitle>Создать папку</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название папки"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderOpen(false)}>Отмена</Button>
          <Button onClick={handleCreateFolder} variant="contained">
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)}>
        <DialogTitle>Загрузить файл</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              style={{ display: 'block', marginBottom: '16px' }}
            />
            {selectedFile && (
              <Typography variant="body2" color="text.secondary">
                Выбран: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
            Отмена
          </Button>
          <Button onClick={handleUploadFile} variant="contained" disabled={!selectedFile || uploading}>
            {uploading ? <CircularProgress size={24} /> : 'Загрузить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false);
          setNewName('');
          setSelectedItem(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Переименовать {selectedItem?.type === 'folder' ? 'папку' : 'файл'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Новое название"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName && newName.trim() && newName.trim() !== selectedItem?.name) {
                e.preventDefault();
                handleRenameSubmit();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRenameDialogOpen(false); setNewName(''); setSelectedItem(null); }}>
            Отмена
          </Button>
          <Button
            onClick={handleRenameSubmit}
            variant="contained"
            disabled={!newName || !newName.trim() || newName.trim() === selectedItem?.name}
          >
            Переименовать
          </Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handleRename}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Переименовать
        </MenuItem>
        {selectedItem?.type === 'file' && (
          <MenuItem onClick={() => { handleDownload(selectedItem.id, selectedItem.name); handleMenuClose(); }}>
            <InsertDriveFile fontSize="small" sx={{ mr: 1 }} />
            Скачать
          </MenuItem>
        )}
        <MenuItem onClick={() => { handleDelete(); handleMenuClose(); }} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Удалить
        </MenuItem>
      </Menu>
    </Box>
  );
}

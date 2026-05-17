import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Chip,
  Menu,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile,
  CreateNewFolder,
  Upload,
  Home,
  MoreVert,
  NavigateNext,
  FolderOpen,
  Delete,
  Edit,
  DriveFileMove,
} from '@mui/icons-material';

export default function FileManager() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadData();
  }, [currentFolder]);

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
        f => f.parent_id === currentFolder
      );
      setFolders(currentFolderData);

      const currentFiles = allFiles.filter(
        f => (currentFolder ? f.folder === currentFolder : !f.folder)
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
    if (!currentFolder) {
      setBreadcrumbs([]);
      return;
    }

    const path = [];
    let folderId = currentFolder;
    
    while (folderId) {
      const folder = allFolders.find(f => f.id === folderId);
      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parent_id;
    }
    
    setBreadcrumbs(path);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await api.post('/folders/create/', {
        name: newFolderName,
        parent_id: currentFolder
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
    if (currentFolder) {
      formData.append('folder_id', currentFolder);
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
    setCurrentFolder(folderId);
  };

  const handleBreadcrumbClick = (folderId) => {
    setCurrentFolder(folderId);
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
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Ошибка скачивания файла');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Box sx={{ backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', px: 3, py: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Файловый менеджер
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/files')}>
                Назад к списку
              </Button>
              <Button variant="outlined" onClick={logout}>
                Выход
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
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

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Breadcrumbs separator={<NavigateNext fontSize="small" />}>
              <Link
                component="button"
                variant="body1"
                onClick={() => handleBreadcrumbClick(null)}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
              >
                <Home fontSize="small" />
                Корень
              </Link>
              {breadcrumbs.map((folder) => (
                <Link
                  key={folder.id}
                  component="button"
                  variant="body1"
                  onClick={() => handleBreadcrumbClick(folder.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  {folder.name}
                </Link>
              ))}
            </Breadcrumbs>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<CreateNewFolder />}
                onClick={() => setCreateFolderOpen(true)}
              >
                Создать папку
              </Button>
              <Button
                variant="contained"
                startIcon={<Upload />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Загрузить файл
              </Button>
            </Box>
          </Box>
        </Paper>

        {folders.length === 0 && files.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center' }}>
            <FolderOpen sx={{ fontSize: 80, color: '#bdbdbd', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Папка пуста
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Создайте папку или загрузите файл, чтобы начать работу
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<CreateNewFolder />}
                onClick={() => setCreateFolderOpen(true)}
              >
                Создать папку
              </Button>
              <Button
                variant="contained"
                startIcon={<Upload />}
                onClick={() => setUploadDialogOpen(true)}
              >
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
                  <TableRow
                    key={`folder-${folder.id}`}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleFolderClick(folder.id)}
                  >
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
                    <TableCell>{formatDate(folder.updated_at)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, folder, 'folder')}
                      >
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
                    <TableCell>{formatDate(file.date)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, file, 'file')}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
          <Button
            onClick={handleUploadFile}
            variant="contained"
            disabled={!selectedFile || uploading}
          >
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
          <Button onClick={() => {
            setRenameDialogOpen(false);
            setNewName('');
            setSelectedItem(null);
          }}>
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

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleRename}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Переименовать
        </MenuItem>
        {selectedItem?.type === 'file' && (
          <MenuItem onClick={() => {
            handleDownload(selectedItem.id, selectedItem.name);
            setMenuAnchor(null);
            setSelectedItem(null);
          }}>
            <InsertDriveFile fontSize="small" sx={{ mr: 1 }} />
            Скачать
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Удалить
        </MenuItem>
      </Menu>
    </Box>
  );
}

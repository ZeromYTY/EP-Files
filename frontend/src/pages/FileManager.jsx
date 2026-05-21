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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Link as MuiLink,
  Fab,
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
  Star,
  Folder as FolderIcon,
  Upload,
  Description,
  TableChart,
  CreateNewFolder,
  NavigateNext,
  FolderOpen,
  Delete,
  Edit,
  CloudUpload,
  ArrowDropUp,
  Download as DownloadIcon,
  ArrowDropDown,
  CheckCircle,
  Close,
  InsertDriveFile,
} from '@mui/icons-material';

import FileList from '../components/file-manager/FileList';
import MoveFolderDialog from '../components/file-manager/MoveFolderDialog';

export default function FileManager({ onPreviewFile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [favoriteIds, setFavoriteIds] = useState({ files: [], folders: [] });
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
  const [deleteDialogOpen, setDeleteDialogOpenOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const [anchorEl, setAnchorEl] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);

  const getApiErrorMessage = (err, fallbackMessage = 'Произошла ошибка') => {
  const serverMessage =
    err.response?.data?.error ||
    err.response?.data?.detail ||
    err.response?.data?.message;

  if (!serverMessage) {
    return fallbackMessage;
  }

  const translations = {
    'Access denied': 'Нет прав для выполнения операции',
    'Folder not found': 'Папка не найдена',
    'File not found': 'Файл не найден',
    'Target folder not found': 'Папка назначения не найдена',
    'Cannot move folder into its own subtree': 'Нельзя переместить папку внутрь самой себя',
    'New name is required': 'Введите новое название',
    'Folder name is required': 'Введите название папки',
    'Upload failed': 'Не удалось загрузить файл',
    'Download failed': 'Не удалось скачать файл',
  };

  return translations[serverMessage] || serverMessage;
};

  useEffect(() => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get(`/search/?q=${encodeURIComponent(searchQuery)}`);
        const results = response.data.results || [];
        setFiles(results.filter(i => i.type !== 'folder'));
        setFolders(results.filter(i => i.type === 'folder'));
        setError('');
      } catch (err) {
        console.error('Ошибка при поиске:', err);
        setError(getApiErrorMessage(err, 'Ошибка при поиске'));
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      loadData();
    }
  }, [currentFolderId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const ts = Date.now();
      const [foldersRes, filesRes, favsRes] = await Promise.all([
        api.get(`folders/?_ts=${ts}`),
        api.get(`files/?_ts=${ts}`),
        api.get(`favorites/all/?_ts=${ts}`)
      ]);

      setFavoriteIds({
        files: favsRes.data.file_ids || [],
        folders: favsRes.data.folder_ids || []
      });

      const allFolders = foldersRes.data.folders || [];
      const allFiles = filesRes.data || [];

      const filesByFolderMap = {};
      allFiles.forEach(file => {
        const folderId = file.folder;
        if (!filesByFolderMap[folderId]) filesByFolderMap[folderId] = [];
        filesByFolderMap[folderId].push(file);
      });

      const calculateFolderSize = (folderId) => {
        const directFiles = filesByFolderMap[folderId] || [];
        const directFilesSize = directFiles.reduce((sum, f) => sum + (Number(f.size) || 0), 0);

        const subFolders = allFolders.filter(f => f.parent_id === folderId);
        const subFoldersSize = subFolders.reduce((sum, subFolder) => {
          return sum + calculateFolderSize(subFolder.id);
        }, 0);

        return directFilesSize + subFoldersSize;
      };

      const foldersWithSizes = allFolders
        .filter(f => f.parent_id === currentFolderId)
        .map(folder => ({
          ...folder,
          size: calculateFolderSize(folder.id)
        }));

      setFolders([...foldersWithSizes]);
      setFiles([...allFiles.filter(f => (currentFolderId ? f.folder === currentFolderId : !f.folder))]);
      updateBreadcrumbs(allFolders);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

    const handleCreateFolderClick = () => {
        handleCreateClose();
        setCreateFolderOpen(true);
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

  const getPathArray = () => [
    { id: null, name: 'Главная' },
    ...breadcrumbs.map(b => ({ id: b.id, name: b.name }))
  ];

  const addTask = (id, name, title, subText, status, progress = 0) => {
    setTasks(prev => [...prev, { id, name, title, subText, status, progress }]);
  };

  const updateTask = (id, updatedFields) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t));
  };

  const removeTaskWithTimer = (id) => {
    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const processUpload = async (incomingData, targetFolderId = currentFolderId) => {
    if (!incomingData) return;

    let cleanFiles = [];

    try {
      if (incomingData instanceof File) {
        cleanFiles = [incomingData];
      } else if (incomingData instanceof FileList) {
        cleanFiles = Array.from(incomingData);
      } else if (Array.isArray(incomingData)) {
        cleanFiles = incomingData;
      } else if (incomingData.target?.files) {
        cleanFiles = Array.from(incomingData.target.files);
      } else if (incomingData.files) {
        cleanFiles = Array.from(incomingData.files);
      }
    } catch (e) {
      console.error('Ошибка распаковки файлов при загрузке:', e);
    }

    if (cleanFiles.length === 0) {
      console.error('Не удалось извлечь файлы из переданных данных');
      return;
    }

    for (const cleanFile of cleanFiles) {
      const formData = new FormData();
      formData.append('file', cleanFile);

      if (targetFolderId) {
        formData.append('folder_id', targetFolderId);
      }

      const taskId = 'upload-' + Date.now() + Math.random().toString(36).substr(2, 4);

      try {
        setIsWidgetMinimized(false);
        addTask(taskId, cleanFile.name, 'Загрузка файла...', 'Отправка в облако', 'uploading', 0);

        await api.post('/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        await new Promise((resolve) => {
          let currentSimulatedProgress = 0;
          const interval = setInterval(() => {
            currentSimulatedProgress += Math.floor(Math.random() * 8) + 4;
            if (currentSimulatedProgress >= 100) {
              currentSimulatedProgress = 100;
              clearInterval(interval);
              resolve();
            }
            updateTask(taskId, { progress: currentSimulatedProgress });
          }, 100);
        });

        updateTask(taskId, {
          title: 'Загрузка завершена',
          subText: 'Файл успешно сохранен',
          status: 'success',
          progress: 100
        });

        setTimeout(() => {
          loadData();
        }, 100);
        removeTaskWithTimer(taskId);

      } catch (err) {
        console.error(`Критическая ошибка при отправке файла ${cleanFile.name}:`, err);
        updateTask(taskId, {
          title: 'Ошибка загрузки',
          subText: err.response?.data?.error || 'Не удалось загрузить файл',
          status: 'error'
        });
        removeTaskWithTimer(taskId);
      }
    }
  };


  const handleFileDropped = (acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      processUpload(acceptedFiles[0], currentFolderId);
    }
  };

  const handleManualUpload = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      processUpload(event.target.files[0], currentFolderId);
      event.target.value = '';
    }
  };

  const handleDownload = async (id, name, type) => {
    const taskId = 'download-' + Date.now() + Math.random().toString(36).substr(2, 4);
    try {
      setIsWidgetMinimized(false);
      const isFolder = type === 'folder';

      addTask(
        taskId,
        name + (isFolder ? '.zip' : ''),
        isFolder ? 'Архивация и скачивание папки...' : 'Скачивание файла...',
        'Подготовка потока данных',
        'downloading'
      );

      const url = isFolder ? `folders/${id}/download/` : `download/${id}/`;
      const response = await api.get(url, { responseType: 'blob' });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', isFolder ? `${name}.zip` : name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      updateTask(taskId, {
        title: isFolder ? 'Архив успешно скачан' : 'Скачивание завершено',
        subText: 'Сохранено на устройство',
        status: 'success'
      });
      removeTaskWithTimer(taskId);
    } catch (err) {
      console.error('Ошибка при скачивании:', err);
      updateTask(taskId, {
        title: 'Ошибка скачивания',
        subText: err.response?.status === 404 ? 'Объект не найден' : 'Нет прав доступа',
        status: 'error'
      });
      removeTaskWithTimer(taskId);
    }
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    setFileToDelete({ id: selectedItem.id, name: selectedItem.name, type: selectedItem.type });
    setDeleteDialogOpenOpen(true);
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    const taskId = 'delete-' + Date.now();
    try {
      setIsWidgetMinimized(false);
      addTask(taskId, fileToDelete.name, 'Удаление объекта...', 'Очистка диска', 'deleting');
      setDeleteDialogOpenOpen(false);

      if (fileToDelete.type === 'folder') {
        await api.delete(`/folders/${fileToDelete.id}/delete/`);
      } else {
        await api.delete(`/files/${fileToDelete.id}/`);
      }

      updateTask(taskId, { title: 'Удалено успешно', subText: 'Файл полностью стерт', status: 'success' });
      setSelectedItem(null);
      setFileToDelete(null);
      loadData();
      removeTaskWithTimer(taskId);
    } catch (err) {
      updateTask(taskId, {
        title: 'Ошибка удаления',
        subText: getApiErrorMessage(err, 'Не удалось удалить объект'),
        status: 'error'
      });
      removeTaskWithTimer(taskId);
      setSelectedItem(null);
      setFileToDelete(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/folders/create/', { name: newFolderName, parent_id: currentFolderId });
      setNewFolderName('');
      setCreateFolderOpen(false);
      loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Ошибка создания папки'));
    }
  };

  const handleRenameSubmit = async () => {
    const trimmedName = (newName || '').trim();
    if (!trimmedName || !selectedItem) return;
    try {
      if (selectedItem.type === 'folder') {
        await api.patch(`/folders/${selectedItem.id}/rename/`, { name: trimmedName });
      } else {
        await api.patch(`/files/${selectedItem.id}/`, { name: trimmedName });
      }
      setRenameDialogOpen(false);
      setNewName('');
      loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Ошибка переименования'));
    }
  };

  const handleFolderClick = (id) => setCurrentFolderId(id);
  const handleBreadcrumbClick = (id) => setCurrentFolderId(id);
  const handleGoHome = () => setCurrentFolderId(null);
  const handleBack = () => {
    if (currentFolderId !== null) {
      const current = breadcrumbs.find(f => f.id === currentFolderId);
      setCurrentFolderId(current?.parent_id || null);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const handleCreateClick = (e) => setAnchorEl(e.currentTarget);
  const handleCreateClose = () => setAnchorEl(null);
  const handleMenuOpen = (e, item, type) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); setSelectedItem({ ...item, type }); };
  const handleMenuClose = () => setMenuAnchor(null);
  const handleRenameClick = () => { setNewName(selectedItem.name || ''); setRenameDialogOpen(true); handleMenuClose(); };

  const handleMoveClick = () => {
  if (!selectedItem) {
    setError('Не выбран объект для перемещения');
    handleMenuClose();
    return;
  }

  setMoveDialogOpen(true);
  handleMenuClose();
};

  const sortedItems = [
    ...folders.map(f => ({ ...f, type: 'folder', is_favorite: favoriteIds.folders.includes(f.id) })),
    ...files.map(f => ({ ...f, type: 'file', is_favorite: favoriteIds.files.includes(f.id) }))
  ].sort((a, b) => (a.type === 'folder' && b.type !== 'folder' ? -1 : a.type !== 'folder' && b.type === 'folder' ? 1 : a.name.localeCompare(b.name)));

  const getCurrentLocationName = () => {
    if (!currentFolderId) return 'Главная';
    const active = breadcrumbs.find(b => b.id === currentFolderId);
    return active ? active.name : 'Папка';
  };

  const isFabMenuOpen = Boolean(anchorEl);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8f9fa', position: 'relative' }}>
    <input type="file" id="manual-file-input" onChange={handleManualUpload} style={{ display: 'none' }} />

      <Box sx={{ backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1000 }}>
        <Box component="a" href="/" sx={{ display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#2196F3', fontSize: '1.5rem' }}>ep-files</Typography>
        </Box>
        <Box sx={{ flex: 1, maxWidth: 600, mx: 4 }}>
          <TextField fullWidth placeholder="Поиск файлов..." size="small" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#9e9e9e' }} /></InputAdornment>, sx: { backgroundColor: '#f1f3f4', borderRadius: '8px', '& fieldset': { border: 'none' } } }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title={user?.email || 'Пользователь'}><IconButton onClick={() => navigate('/files')} sx={{ backgroundColor: '#2196F3', color: '#fff' }}><Person /></IconButton></Tooltip>
          <Button variant="outlined" size="small" onClick={handleLogout} startIcon={<Logout />} sx={{ color: '#d32f2f', borderColor: '#d32f2f', '&:hover': { borderColor: '#c62828', backgroundColor: 'rgba(211, 47, 47, 0.04)' } }}>Выйти</Button>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: '12px', border: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <IconButton size="small" onClick={handleBack} disabled={currentFolderId === null} sx={{ color: currentFolderId === null ? '#bdbdbd' : '#2196F3' }}><ArrowBack /></IconButton>
            <IconButton size="small" onClick={handleGoHome} disabled={currentFolderId === null} sx={{ color: currentFolderId === null ? '#bdbdbd' : '#2196F3' }}><Home /></IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MuiLink component="button" variant="body1" onClick={() => handleBreadcrumbClick(null)} sx={{ textDecoration: 'none', color: '#2196F3', cursor: 'pointer' }}>Корень</MuiLink>
              {breadcrumbs.map((folder) => (
                <Box key={folder.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <NavigateNext fontSize="small" sx={{ color: '#9e9e9e' }} />
                  <MuiLink component="button" variant="body1" onClick={() => handleBreadcrumbClick(folder.id)} sx={{ textDecoration: 'none', color: '#2196F3', cursor: 'pointer' }}>{folder.name}</MuiLink>
                </Box>
              ))}
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton size="small" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} sx={{ color: '#2196F3' }}>{viewMode === 'list' ? <GridView /> : <ViewList />}</IconButton>
          </Box>
        </Paper>

        <Box sx={{ mb: 3 }}><Typography variant="h5" sx={{ fontWeight: 600, color: '#202124' }}>{getCurrentLocationName()}</Typography><Typography variant="body2" color="text.secondary">{sortedItems.length} объектов</Typography></Box>

        {sortedItems.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyY: 'center', py: 12, textAlign: 'center' }}>
            <Box sx={{ width: 96, height: 96, backgroundColor: '#e8f0fe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyX: 'center', mb: 3, mx: 'auto' }}>
              <CloudUpload sx={{ fontSize: 48, color: '#a0aec0', margin: 'auto' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 1.5, fontSize: '2rem' }}>Пусто</Typography>
            <Typography variant="body1" sx={{ color: '#64748b', maxWidth: 320, lineHeight: 1.6 }}>Попробуйте добавить файлы, перетащив их сюда или нажав круглую кнопку справа внизу</Typography>
          </Box>
        ) : (
          <FileList
            files={sortedItems}
            viewMode={viewMode}
            onFolderClick={handleFolderClick}
            onDownloadClick={handleDownload}
            onPreviewClick={onPreviewFile}
            onDeleteClick={handleDelete}
            onMenuOpen={handleMenuOpen}
            onFileDropped={(filesArray, targetFolderId) => {
              if (filesArray && filesArray.length > 0) {
                processUpload(filesArray[0], targetFolderId);
              }
            }}
          />
        )}
      </Container>

      <Box sx={{ position: 'fixed', bottom: tasks.length > 0 ? 116 : 48, right: 48, zIndex: 1100, transition: 'bottom 0.3s ease' }}>
        <Tooltip title="Создать или загрузить" placement="left">
          <Fab
            variant="extended"
            onClick={handleCreateClick}
            sx={{
              backgroundColor: '#2196F3',
              color: '#fff',
              px: 5,
              py: 4,
              borderRadius: '9999px',
              textTransform: 'none',
              gap: 1.5,
              boxShadow: '0 8px 24px rgba(33, 150, 243, 0.35)',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: '#1976D2',
                boxShadow: '0 10px 28px rgba(33, 150, 243, 0.5)',
                transform: 'scale(1.03)'
              }
            }}
          >
            <Add
              sx={{
                transform: isFabMenuOpen ? 'rotate(135deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                fontSize: '1.8rem'
              }}
            />
            <Typography variant="button" sx={{ fontWeight: 800, letterSpacing: '0.5px', fontSize: '1.05rem' }}>
              Создать
            </Typography>
          </Fab>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={isFabMenuOpen}
        onClose={handleCreateClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            mb: 2,
            minWidth: 165,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            '& .MuiMenu-list': { py: 0.5 },
            '& .MuiMenuItem-root': {
              py: 1,
              px: 2,
              fontSize: '0.9rem'
            }
          }
        }}
      >
        <MenuItem onClick={() => { handleCreateClose(); setCreateFolderOpen(true); }}><FolderIcon sx={{ color: '#FF9800', mr: 1.5, fontSize: 20 }} /> Папка</MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { handleCreateClose(); document.getElementById('manual-file-input')?.click(); }}><Upload sx={{ color: '#9C27B0', mr: 1.5, fontSize: 20 }} /> Загрузить файл</MenuItem>
      </Menu>

      <Dialog open={createFolderOpen} onClose={() => setCreateFolderOpen(false)}>
        <DialogTitle>Создать папку</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Название папки" fullWidth value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderOpen(false)}>Отмена</Button>
          <Button onClick={handleCreateFolder} variant="contained">Создать</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameDialogOpen} onClose={() => { setRenameDialogOpen(false); setNewName(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Переименовать {selectedItem?.type === 'folder' ? 'папку' : 'файл'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField autoFocus margin="dense" label="Новое название" fullWidth value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newName.trim() && handleRenameSubmit()} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleRenameSubmit} variant="contained" disabled={!newName || !newName.trim() || newName.trim() === selectedItem?.name}>Переименовать</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpenOpen(false)}>
        <DialogTitle sx={{ fontWeight: 600 }}>Удалить объект?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы действительно хотите удалить {fileToDelete?.type === 'folder' ? 'папку' : 'файл'} "{fileToDelete?.name}"? Действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpenOpen(false)}>Отмена</Button>
          <Button onClick={handleConfirmDelete} variant="contained" sx={{ backgroundColor: '#D32F2F' }}>Удалить</Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
          <MenuItem onClick={handleRenameClick}>
              <Edit fontSize="small" sx={{ mr: 1.5, color: '#616161' }} /> Переименовать
                </MenuItem>

          <MenuItem onClick={handleMoveClick}>
    <       FolderOpen fontSize="small" sx={{ mr: 1.5, color: '#616161' }} />
            Переместить
          </MenuItem>

      <MenuItem onClick={() => { alert(`⭐ Состояние избранного изменено для: ${selectedItem?.name}`); handleMenuClose(); }}>
          <Star sx={{ fontSize: 18, mr: 1.5, color: '#616161' }} />
          {selectedItem?.isFavorite ? 'Убрать из избранного' : 'В избранное'}
        </MenuItem>

        <MenuItem onClick={() => { handleDownload(selectedItem.id, selectedItem.name, selectedItem.type); handleMenuClose(); }}>
          <DownloadIcon fontSize="small" sx={{ mr: 1.5, color: '#616161' }} />
          {selectedItem?.type === 'folder' ? 'Скачать как ZIP' : 'Скачать'}
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1.5, color: '#D32F2F' }} /> Удалить
        </MenuItem>
      </Menu>

      {tasks.length > 0 && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 360,
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.16)',
            zIndex: 2000,
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Выполняется операций: {tasks.filter(t => ['uploading', 'downloading', 'deleting'].includes(t.status)).length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton size="small" sx={{ color: '#64748b' }} onClick={() => setIsWidgetMinimized(!isWidgetMinimized)}>
                {isWidgetMinimized ? <ArrowDropUp /> : <ArrowDropDown />}
              </IconButton>
              <IconButton size="small" sx={{ color: '#64748b' }} onClick={() => setTasks([])}>
                <Close fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {!isWidgetMinimized && (
            <Box sx={{ overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1, backgroundColor: '#ffffff', maxHeight: 300 }}>
              {tasks.map((task) => (
                <Box
                  key={task.id}
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    borderRadius: '8px',
                    border: '1px solid #f1f5f9',
                    backgroundColor: task.status === 'success' ? '#f0fdf4' : task.status === 'error' ? '#fef2f2' : '#ffffff'
                  }}
                >
                  {['uploading', 'downloading', 'deleting'].includes(task.status) ? (
                    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                      <CircularProgress variant={task.status === 'uploading' ? "determinate" : "indeterminate"} value={task.status === 'uploading' ? task.progress : undefined} size={32} thickness={4.5} sx={{ color: '#2196F3' }} />
                      {task.status === 'uploading' && (
                        <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>{task.progress}%</Typography>
                        </Box>
                      )}
                    </Box>
                  ) : task.status === 'success' ? (
                    <CheckCircle sx={{ color: '#16a34a', fontSize: 32, flexShrink: 0 }} />
                  ) : (
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '0.9rem' }}>⚠️</Box>
                  )}
                  <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.name}</Typography>
                    <Typography variant="caption" sx={{ color: task.status === 'success' ? '#16a34a' : task.status === 'error' ? '#ef4444' : '#64748b', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.subText}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import StorageStats from '../components/file-manager/StorageStats';
import ActionBar from '../components/file-manager/ActionBar';
import FilesTable from '../components/file-manager/FilesTable';
import {
  Container,
  Paper,
  Typography,
  Box,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  IconButton,
  FormControl,
  Select,
  MenuItem
} from '@mui/material';
import { Folder, Logout, CheckCircle, Close, ArrowDropUp, ArrowDropDown, Share, Lock, ContentCopy } from '@mui/icons-material';

export default function Files() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storageStats, setStorageStats] = useState(null);

  const [deleteDialogOpen, setDeleteDialogOpenOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState(null);
  const [accessType, setAccessType] = useState('restricted');

  const [tasks, setTasks] = useState([]);
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/files/');
      setFiles(response.data);
      setError('');
    } catch (err) {
      setError('Ошибка при загрузке файлов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const response = await api.get('/storage/stats/');
      setStorageStats(response.data);
    } catch (err) {
      console.error('Ошибка при загрузке статистики:', err);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchStorageStats();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchFiles();
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await api.get(`/search/?q=${encodeURIComponent(searchQuery)}`);
        setFiles(response.data.results);
      } catch (err) {
        console.error('Ошибка при поиске:', err);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
  };

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

  const processUpload = async (file) => {
    if (!file) return;

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      handleFileRejected(file.name, 'Файл превышает максимальный размер 100 MB');
      return;
    }

    if (storageStats && file.size > storageStats.available_space) {
      handleFileRejected(file.name, 'Недостаточно места в хранилище');
      return;
    }

    const taskId = 'upload-' + Date.now() + Math.random().toString(36).substr(2, 4);
    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      setUploadProgress(0);

      addTask(taskId, file.name, 'Загрузка объекта...', 'Сохранение в облако', 'uploading', 0);
      setError('');

      await api.post('/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
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
        subText: 'Файл доступен в списке',
        status: 'success',
        progress: 100
      });
      fetchFiles();
      fetchStorageStats();
      removeTaskWithTimer(taskId);
    } catch (err) {
      updateTask(taskId, {
        title: 'Ошибка загрузки',
        subText: err.response?.data?.error || 'Не удалось загрузить файл',
        status: 'error'
      });
      removeTaskWithTimer(taskId);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      processUpload(event.target.files[0]);
      event.target.value = '';
    }
  };

  const handleDownload = async (fileId, fileName) => {
    const taskId = 'download-' + Date.now() + Math.random().toString(36).substr(2, 4);
    try {
      addTask(taskId, fileName, 'Скачивание файла...', 'Подготовка потока данных', 'downloading');
      const response = await api.get(`/download/${fileId}/`, {
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

      updateTask(taskId, {
        title: 'Скачивание завершено',
        subText: 'Файл сохранен на устройство',
        status: 'success'
      });
      removeTaskWithTimer(taskId);
    } catch (err) {
      updateTask(taskId, {
        title: 'Ошибка скачивания',
        subText: err.response?.status === 403 ? 'Нет прав на скачивание' : 'Файл не найден',
        status: 'error'
      });
      removeTaskWithTimer(taskId);
      console.error(err);
    }
  };

  const handleOpenDeleteDialog = (fileId, fileName) => {
    setFileToDelete({ id: fileId, name: fileName });
    setDeleteDialogOpenOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpenOpen(false);
    setTimeout(() => {
      setFileToDelete(null);
    }, 300);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete || !fileToDelete.id) return;
    const taskId = 'delete-' + Date.now() + Math.random().toString(36).substr(2, 4);
    try {
      addTask(taskId, fileToDelete.name, 'Удаление файла...', 'Очистка дискового пространства', 'deleting');
      setDeleteDialogOpenOpen(false);

      await api.delete(`/files/${fileToDelete.id}/`);

      updateTask(taskId, {
        title: 'Удалено успешно',
        subText: 'Файл полностью стерт',
        status: 'success'
      });
      fetchFiles();
      fetchStorageStats();
      removeTaskWithTimer(taskId);
    } catch (err) {
      updateTask(taskId, {
        title: 'Ошибка удаления',
        subText: err.response?.status === 403 ? 'Нет прав на удаление' : 'Ошибка сервера',
        status: 'error'
      });
      removeTaskWithTimer(taskId);
      console.error(err);
    }
  };

  const handleOpenShareDialog = (fileId, fileName) => {
    setFileToShare({ id: fileId, name: fileName });
    setAccessType('restricted');
    setShareDialogOpen(true);
  };

  const handleCloseShareDialog = () => {
    setShareDialogOpen(false);
    setTimeout(() => {
      setFileToShare(null);
      setAccessType('restricted');
    }, 300);
  };

  const handleCopyShareLink = () => {
    if (!fileToShare) return;
    const shareUrl = `${window.location.origin}/api/download/${fileToShare.id}/`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      const taskId = 'share-' + Date.now();
      addTask(taskId, fileToShare.name, 'Ссылка скопирована', 'Добавлено в буфер обмена', 'success');
      removeTaskWithTimer(taskId);
      handleCloseShareDialog();
    });
  };

  const handleFileRejected = (fileName, errorMessage) => {
    const taskId = 'error-' + Date.now() + Math.random().toString(36).substr(2, 4);
    addTask(taskId, fileName, 'Ошибка операции', errorMessage, 'error');
    removeTaskWithTimer(taskId);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Container maxWidth="lg" sx={{ position: 'relative' }}>
      <Paper sx={{ p: 4, mt: 4, borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Мои файлы</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" component={Link} to="/" startIcon={<Folder />}>
              На главную
            </Button>
            <Button variant="outlined" color="error" startIcon={<Logout />} onClick={handleLogout}>
              Выйти
            </Button>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Вы вошли как: <strong>{user?.name || user?.email || 'Пользователь'}</strong>
        </Alert>

        <StorageStats stats={storageStats} formatFileSize={formatFileSize} />

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <ActionBar
          searchQuery={searchQuery}
          setSearchQuery={handleSearchChange}
          isUploading={isUploading}
          storageStats={storageStats}
          handleFileUpload={handleFileUpload}
        />

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Загруженные файлы ({files.length})
        </Typography>

        <FilesTable
          loading={loading}
          files={files}
          allFiles={files}
          searchQuery={searchQuery}
          isUploading={isUploading}
          onFileDropped={processUpload}
          onFileRejected={handleFileRejected}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
          handleDownload={handleDownload}
          handleOpenDeleteDialog={handleOpenDeleteDialog}
          handleOpenShareDialog={handleOpenShareDialog}
        />
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>Удалить файл?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы действительно хотите удалить файл "{fileToDelete?.name}"? Это действие нельзя будет отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleCloseDeleteDialog} sx={{ color: '#2196F3', textTransform: 'none', fontWeight: 600 }}>
            Отмена
          </Button>
          <Button onClick={handleConfirmDelete} variant="contained" sx={{ backgroundColor: '#D32F2F', textTransform: 'none', borderRadius: '8px' }}>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={shareDialogOpen}
        onClose={handleCloseShareDialog}
        PaperProps={{ sx: { borderRadius: '16px', p: 1, width: '460px' } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Share sx={{ color: '#2196F3' }} /> Поделиться файлом
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 3, color: '#1e293b' }}>
            {fileToShare?.name}
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#475569' }}>
            Общий доступ
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ p: 1, borderRadius: '50%', backgroundColor: accessType === 'restricted' ? '#f1f5f9' : '#e0f2fe', display: 'flex' }}>
              <Lock sx={{ color: '#64748b' }} />
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={accessType}
                onChange={(e) => setAccessType(e.target.value)}
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="restricted">Доступ ограничен</MenuItem>
                <MenuItem value="public">Все, у кого есть ссылка</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 7, minHeight: '32px' }}>
            {accessType === 'restricted'
              ? 'Доступ к файлу имеют только выбранные пользователи и владельцы'
              : 'Любой пользователь в интернете, у которого есть эта ссылка, сможет скачать файл'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            startIcon={<ContentCopy />}
            onClick={handleCopyShareLink}
            disabled={accessType === 'restricted'}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            Копировать ссылку
          </Button>
          <Button
            onClick={handleCloseShareDialog}
            variant="contained"
            sx={{ borderRadius: '8px', textTransform: 'none', px: 3, backgroundColor: '#2196F3' }}
          >
            Готово
          </Button>
        </DialogActions>
      </Dialog>

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
            maxHeight: 400,
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
            <Box sx={{ overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1, backgroundColor: '#ffffff' }}>
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
                      <CircularProgress
                        variant={task.status === 'uploading' ? "determinate" : "indeterminate"}
                        value={task.status === 'uploading' ? task.progress : undefined}
                        size={32}
                        thickness={4.5}
                        sx={{ color: '#2196F3' }}
                      />
                      {task.status === 'uploading' && (
                        <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
                            {task.progress}%
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ) : task.status === 'success' ? (
                    <CheckCircle sx={{ color: '#16a34a', fontSize: 32, flexShrink: 0 }} />
                  ) : (
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '0.9rem' }}>
                      ⚠️
                    </Box>
                  )}
                  <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {task.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: task.status === 'success' ? '#16a34a' : task.status === 'error' ? '#ef4444' : '#64748b', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {task.subText}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
}

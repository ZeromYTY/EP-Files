import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  ChevronRight,
  DeleteForever,
  DeleteSweep,
  Description,
  Folder,
  FolderOff,
  RestoreFromTrash,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import api from '../api/axios';

function formatFileSize(bytes) {
  if (!bytes) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / 1024 ** index).toFixed(1))} ${units[index]}`;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getErrorMessage(error, fallback) {
  return error.response?.data?.error || error.response?.data?.detail || fallback;
}

function itemLabel(item) {
  return item?.type === 'folder' ? 'Папка' : 'Файл';
}

function EmptyTrash() {
  return (
    <Paper
      elevation={0}
      sx={{
        py: 10,
        px: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px',
        textAlign: 'center',
        backgroundColor: (theme) => theme.ep.panel,
        boxShadow: (theme) => theme.ep.shadow,
      }}
    >
      <Box
        sx={{
          width: 88,
          height: 88,
          mx: 'auto',
          mb: 2,
          borderRadius: '50%',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FolderOff sx={{ fontSize: 44, color: 'text.secondary' }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
        Корзина пуста
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Удаленные файлы и непустые папки появятся здесь.
      </Typography>
    </Paper>
  );
}

function ConfirmDialog({ open, title, text, confirmLabel, confirmColor = 'error', onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{text}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" color={confirmColor} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TrashTable({ items, busyId, onOpenFolder, onRestore, onDelete }) {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', backgroundColor: (theme) => theme.ep.panel, boxShadow: (theme) => theme.ep.shadow }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: (theme) => theme.ep.subtle }}>
            <TableCell sx={{ fontWeight: 800 }}>Объект</TableCell>
            <TableCell sx={{ fontWeight: 800, width: 120 }}>Тип</TableCell>
            <TableCell sx={{ fontWeight: 800, width: 140 }}>Размер</TableCell>
            <TableCell sx={{ fontWeight: 800, width: 220 }}>Удален</TableCell>
            <TableCell align="right" sx={{ fontWeight: 800, width: 150 }}>Действия</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const rowKey = `${item.type}-${item.id}`;
            const isBusy = busyId === rowKey;
            const isFolder = item.type === 'folder';
            const Icon = isFolder ? Folder : Description;
            return (
              <TableRow
                key={rowKey}
                hover
                onClick={isFolder ? () => onOpenFolder(item) : undefined}
                sx={{ cursor: isFolder ? 'pointer' : 'default' }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '8px',
                        bgcolor: (theme) => alpha(theme.palette.primary.main, isFolder ? 0.14 : 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ color: 'primary.main' }} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </Typography>
                    {isFolder && <ChevronRight sx={{ color: 'text.secondary', ml: 'auto' }} />}
                  </Box>
                </TableCell>
                <TableCell>{itemLabel(item)}</TableCell>
                <TableCell>{formatFileSize(item.size)}</TableCell>
                <TableCell>{formatDate(item.deleted_at)}</TableCell>
                <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                  <Tooltip title="Восстановить">
                    <span>
                      <IconButton color="primary" disabled={isBusy} onClick={() => onRestore(item)}>
                        <RestoreFromTrash />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Удалить окончательно">
                    <span>
                      <IconButton color="error" disabled={isBusy} onClick={() => onDelete(item)}>
                        <DeleteForever />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function Trash() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const totalSize = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.size || 0), 0),
    [items],
  );

  const loadTrash = useCallback(async (folderId = null) => {
    setLoading(true);
    try {
      const response = await api.get('/trash/', {
        params: folderId ? { folder_id: folderId } : undefined,
      });
      setItems(response.data?.items || []);
      setCurrentFolder(response.data?.current_folder || null);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось загрузить корзину.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const openFolder = (folder) => {
    setFolderStack((prev) => [...prev, folder]);
    loadTrash(folder.id);
  };

  const goToRoot = () => {
    setFolderStack([]);
    loadTrash();
  };

  const goBack = () => {
    if (folderStack.length <= 1) {
      goToRoot();
      return;
    }
    const nextStack = folderStack.slice(0, -1);
    setFolderStack(nextStack);
    loadTrash(nextStack[nextStack.length - 1].id);
  };

  const endpointFor = (item) => (
    item.type === 'folder' ? `/trash/folders/${item.id}/` : `/trash/${item.id}/`
  );

  const restoreEndpointFor = (item) => (
    item.type === 'folder' ? `/trash/folders/${item.id}/restore/` : `/trash/${item.id}/restore/`
  );

  const removeItemFromView = (item) => {
    setItems((prev) => prev.filter((current) => current.id !== item.id || current.type !== item.type));
  };

  const restoreItem = async (item) => {
    const rowKey = `${item.type}-${item.id}`;
    setBusyId(rowKey);
    setError('');
    try {
      await api.patch(restoreEndpointFor(item));
      removeItemFromView(item);
      setSuccess(`${itemLabel(item)} "${item.name}" восстановлен${item.type === 'folder' ? 'а' : ''}.`);
      if (currentFolder && items.length === 1) goToRoot();
    } catch (err) {
      setError(getErrorMessage(err, `Не удалось восстановить ${item.type === 'folder' ? 'папку' : 'файл'}.`));
    } finally {
      setBusyId(null);
    }
  };

  const deleteItem = async () => {
    if (!itemToDelete) return;
    const rowKey = `${itemToDelete.type}-${itemToDelete.id}`;
    setBusyId(rowKey);
    setError('');
    try {
      await api.delete(endpointFor(itemToDelete));
      removeItemFromView(itemToDelete);
      setSuccess(`${itemLabel(itemToDelete)} "${itemToDelete.name}" удален${itemToDelete.type === 'folder' ? 'а' : ''} окончательно.`);
      setItemToDelete(null);
      if (currentFolder && items.length === 1) goToRoot();
    } catch (err) {
      setError(getErrorMessage(err, `Не удалось удалить ${itemToDelete.type === 'folder' ? 'папку' : 'файл'} окончательно.`));
    } finally {
      setBusyId(null);
    }
  };

  const clearTrash = async () => {
    setBusyId('clear');
    setError('');
    try {
      const response = await api.delete('/trash/clear/');
      setItems([]);
      setCurrentFolder(null);
      setFolderStack([]);
      setSuccess(`Корзина очищена. Удалено файлов: ${response.data?.deleted_count ?? 0}, папок: ${response.data?.deleted_folders_count ?? 0}.`);
      setClearDialogOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось очистить корзину.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/file-manager')}>К файлам</Button>
            {currentFolder && <Button onClick={goBack}>Назад в корзине</Button>}
            {currentFolder && <Button onClick={goToRoot}>Корень корзины</Button>}
            <Button onClick={() => loadTrash(currentFolder?.id || null)}>Обновить</Button>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: 0 }}>
            {currentFolder ? currentFolder.name : 'Корзина файлов'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {items.length} объектов · {formatFileSize(totalSize)}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteSweep />}
          disabled={items.length === 0 || Boolean(busyId)}
          onClick={() => setClearDialogOpen(true)}
          sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          Очистить корзину
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <EmptyTrash />
      ) : (
        <TrashTable
          items={items}
          busyId={busyId}
          onOpenFolder={openFolder}
          onRestore={restoreItem}
          onDelete={setItemToDelete}
        />
      )}

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title={`Удалить ${itemToDelete?.type === 'folder' ? 'папку' : 'файл'} окончательно?`}
        text={`${itemLabel(itemToDelete)} "${itemToDelete?.name || ''}" будет удален${itemToDelete?.type === 'folder' ? 'а' : ''} без возможности восстановления.`}
        confirmLabel="Удалить"
        onClose={() => setItemToDelete(null)}
        onConfirm={deleteItem}
      />
      <ConfirmDialog
        open={clearDialogOpen}
        title="Очистить корзину?"
        text="Все файлы и папки в корзине будут удалены окончательно."
        confirmLabel="Очистить"
        onClose={() => setClearDialogOpen(false)}
        onConfirm={clearTrash}
      />
    </Box>
  );
}

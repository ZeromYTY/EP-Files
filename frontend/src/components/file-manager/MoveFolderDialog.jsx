import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import api from '../../api/axios';

/**
 * Модальное окно для перемещения файла или папки.
 */
export default function MoveFolderDialog({
  open,
  item,
  folder,
  currentFolderId,
  onClose,
  onMoved,
}) {
  const movingItem = item || folder;
  const isFolder = movingItem?.type === 'folder';

  const [folders, setFolders] = useState([]);
  const [targetFolderId, setTargetFolderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) return;

    const loadFolders = async () => {
      try {
        setLocalError('');
        setTargetFolderId(currentFolderId ?? '');

        const response = await api.get('/folders/');
        setFolders(response.data.folders || []);
      } catch (err) {
        console.error('Ошибка загрузки папок:', err);
        setLocalError('Не удалось загрузить список папок');
      }
    };

    loadFolders();
  }, [open, currentFolderId]);

  const isChildFolder = (possibleChildId, parentId) => {
    let current = folders.find((folderItem) => folderItem.id === possibleChildId);

    while (current) {
      if (current.parent_id === parentId) {
        return true;
      }

      current = folders.find((folderItem) => folderItem.id === current.parent_id);
    }

    return false;
  };

  const getAvailableFolders = () => {
    if (!movingItem) return [];

    return folders.filter((folderItem) => {
      if (isFolder && folderItem.id === movingItem.id) return false;
      if (isFolder && isChildFolder(folderItem.id, movingItem.id)) return false;

      return true;
    });
  };

  const getApiErrorMessage = (err) => (
    err.response?.data?.error ||
    err.response?.data?.detail ||
    'Не удалось переместить объект'
  );

  const handleMove = async () => {
    if (!movingItem) return;

    const destinationId = targetFolderId === '' ? null : targetFolderId;

    try {
      setLoading(true);
      setLocalError('');

      if (isFolder) {
        await api.patch(`/folders/${movingItem.id}/move/`, {
          parent_id: destinationId,
        });
      } else {
        await api.patch(`/files/${movingItem.id}/move/`, {
          folder_id: destinationId,
        });
      }

      onMoved?.(movingItem);
      onClose();
    } catch (err) {
      console.error('Ошибка перемещения:', err);
      setLocalError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const itemTypeLabel = isFolder ? 'папку' : 'файл';

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Переместить {itemTypeLabel}</DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Выберите, куда переместить {itemTypeLabel} “{movingItem?.name}”.
        </Typography>

        {localError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {localError}
          </Alert>
        )}

        <FormControl fullWidth>
          <InputLabel shrink>Новая папка</InputLabel>
          <Select
              displayEmpty
              label="Новая папка"
              value={targetFolderId}
              onChange={(event) => setTargetFolderId(event.target.value)}
              disabled={loading}
              renderValue={(selected) => {
                if (selected === '') {
                  return 'Корень';
                }

                const selectedFolder = folders.find((folderItem) => folderItem.id === selected);
                return selectedFolder?.name || 'Корень';
              }}
          >
            <MenuItem value="">Корень</MenuItem>

            {getAvailableFolders().map((folderItem) => (
              <MenuItem key={folderItem.id} value={folderItem.id}>
                {folderItem.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Отмена
        </Button>
        <Button onClick={handleMove} variant="contained" disabled={loading}>
          Переместить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
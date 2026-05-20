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
 * Модальное окно для перемещения папки в корень или в другую папку.
 */
export default function MoveFolderDialog({
  open,
  folder,
  currentFolderId,
  onClose,
  onMoved,
}) {
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
    let current = folders.find((item) => item.id === possibleChildId);

    while (current) {
      if (current.parent_id === parentId) {
        return true;
      }

      current = folders.find((item) => item.id === current.parent_id);
    }

    return false;
  };

  const getAvailableFolders = () => {
    if (!folder) return [];

    return folders.filter((item) => {
      if (item.id === folder.id) return false;
      if (isChildFolder(item.id, folder.id)) return false;

      return true;
    });
  };

  const handleMove = async () => {
    if (!folder) return;

    const parentId = targetFolderId === '' ? null : targetFolderId;

    try {
      setLoading(true);
      setLocalError('');

      await api.patch(`/folders/${folder.id}/move/`, {
        parent_id: parentId,
      });

      onMoved?.();
      onClose();
    } catch (err) {
      console.error('Ошибка перемещения папки:', err);
      setLocalError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          'Не удалось переместить папку'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Переместить папку</DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Выберите, куда переместить папку “{folder?.name}”.
        </Typography>

        {localError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {localError}
          </Alert>
        )}

        <FormControl fullWidth>
          <InputLabel>Новая папка</InputLabel>
          <Select
            label="Новая папка"
            value={targetFolderId}
            onChange={(event) => setTargetFolderId(event.target.value)}
            disabled={loading}
          >
            <MenuItem value="">Корень</MenuItem>

            {getAvailableFolders().map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name}
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
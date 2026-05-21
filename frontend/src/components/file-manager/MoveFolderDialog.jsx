import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import api from '../../api/axios';

function isChildFolder(folders, possibleChildId, parentId) {
  let current = folders.find((folderItem) => folderItem.id === possibleChildId);
  while (current) {
    if (current.parent_id === parentId) return true;
    current = folders.find((folderItem) => folderItem.id === current.parent_id);
  }
  return false;
}

function availableFolders(folders, movingItem, isFolder) {
  if (!movingItem) return [];
  return folders.filter((folderItem) => {
    if (isFolder && folderItem.id === movingItem.id) return false;
    if (isFolder && isChildFolder(folders, folderItem.id, movingItem.id)) return false;
    return true;
  });
}

async function moveItem({ movingItem, isFolder, targetFolderId }) {
  const destinationId = targetFolderId === '' ? null : targetFolderId;
  const url = isFolder ? `/folders/${movingItem.id}/move/` : `/files/${movingItem.id}/move/`;
  const payload = isFolder ? { parent_id: destinationId } : { folder_id: destinationId };
  await api.patch(url, payload);
}

export default function MoveFolderDialog({ open, item, folder, currentFolderId, onClose, onMoved }) {
  const movingItem = item || folder;
  const isFolder = movingItem?.type === 'folder';
  const [folders, setFolders] = useState([]);
  const [targetFolderId, setTargetFolderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) return;
    api.get('/folders/').then((response) => {
      setLocalError(''); setTargetFolderId(currentFolderId ?? ''); setFolders(response.data.folders || []);
    }).catch((err) => {
      console.error('Ошибка загрузки папок:', err); setLocalError('Не удалось загрузить список папок');
    });
  }, [open, currentFolderId]);

  const handleMove = async () => {
    if (!movingItem) return;
    try {
      setLoading(true); setLocalError('');
      await moveItem({ movingItem, isFolder, targetFolderId });
      onMoved?.(movingItem); onClose();
    } catch (err) {
      console.error('Ошибка перемещения:', err);
      setLocalError(err.response?.data?.error || err.response?.data?.detail || 'Не удалось переместить объект');
    } finally {
      setLoading(false);
    }
  };

  const itemTypeLabel = isFolder ? 'папку' : 'файл';
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Переместить {itemTypeLabel}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Выберите, куда переместить {itemTypeLabel} "{movingItem?.name}".</Typography>
        {localError && <Alert severity="error" sx={{ mb: 2 }}>{localError}</Alert>}
        <FormControl fullWidth>
          <InputLabel shrink>Новая папка</InputLabel>
          <Select displayEmpty label="Новая папка" value={targetFolderId} onChange={(event) => setTargetFolderId(event.target.value)} disabled={loading} renderValue={(selected) => folders.find((folderItem) => folderItem.id === selected)?.name || 'Корень'}>
            <MenuItem value="">Корень</MenuItem>
            {availableFolders(folders, movingItem, isFolder).map((folderItem) => <MenuItem key={folderItem.id} value={folderItem.id}>{folderItem.name}</MenuItem>)}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={loading}>Отмена</Button><Button onClick={handleMove} variant="contained" disabled={loading}>Переместить</Button></DialogActions>
    </Dialog>
  );
}

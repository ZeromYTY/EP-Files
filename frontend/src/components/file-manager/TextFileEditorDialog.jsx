import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

function useSaveShortcut({ onSave, saving, loading }) {
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (!saving && !loading) onSave?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave, saving, loading]);
}

function EditorTitle({ file, loading, saving, onCancel }) {
  return (
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography sx={{ fontWeight: 700 }}>{file ? `Редактирование: ${file.name}` : 'Редактирование файла'}</Typography>
        {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
        {saving && <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>Сохранение...</Typography>}
      </Box>
      <IconButton size="small" onClick={onCancel}><CloseIcon /></IconButton>
    </DialogTitle>
  );
}

function LineGutter({ lines, gutterRef }) {
  return (
    <Box ref={gutterRef} sx={{ width: 48, backgroundColor: '#f5f7fa', borderRadius: '6px', px: 1, py: 1, overflow: 'auto', textAlign: 'right', color: '#9e9e9e', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5', userSelect: 'none' }}>
      {Array.from({ length: Math.max(1, lines) }).map((_, index) => <div key={index} style={{ height: '1.5rem' }}>{index + 1}</div>)}
    </Box>
  );
}

function EditorBody({ content, onChange, loading }) {
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) gutterRef.current.scrollTop = textareaRef.current.scrollTop;
  };
  if (loading) return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <LineGutter lines={(content || '').split('\n').length} gutterRef={gutterRef} />
      <TextField inputRef={textareaRef} multiline minRows={16} fullWidth value={content} onChange={(event) => onChange(event.target.value)} placeholder="Текст файла" variant="outlined" sx={{ fontFamily: 'monospace', '& .MuiInputBase-input': { fontFamily: 'monospace' } }} onScroll={handleScroll} />
    </Box>
  );
}

export default function TextFileEditorDialog({ open, file, content, onChange, onSave, onCancel, loading, saving, error }) {
  const [dismissedError, setDismissedError] = useState('');
  const visibleError = error && error !== dismissedError ? error : '';
  useSaveShortcut({ onSave, saving, loading });
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="lg">
      {saving && <LinearProgress color="primary" />}
      <EditorTitle file={file} loading={loading} saving={saving} onCancel={onCancel} />
      <DialogContent dividers>
        {visibleError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDismissedError(error || '')}>{visibleError}</Alert>}
        <EditorBody content={content} onChange={onChange} loading={loading} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel}>Отмена</Button>
        <Button onClick={onSave} variant="contained" disabled={loading || saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
      </DialogActions>
    </Dialog>
  );
}

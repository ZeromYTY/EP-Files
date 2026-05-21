import { useEffect, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, Alert, CircularProgress, Typography, LinearProgress, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function TextFileEditorDialog({ open, file, content, onChange, onSave, onCancel, loading, saving, error }) {
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const [dismissedError, setDismissedError] = useState('');
  const lines = (content || '').split('\n').length;
  const visibleError = error && error !== dismissedError ? error : '';

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving && !loading) onSave?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave, saving, loading]);

  const handleScroll = () => {
    if (!textareaRef.current || !gutterRef.current) return;
    gutterRef.current.scrollTop = textareaRef.current.scrollTop;
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="lg">
      {saving && <LinearProgress color="primary" />}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontWeight: 700 }}>{file ? `Редактирование: ${file.name}` : 'Редактирование файла'}</Typography>
          {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
          {saving && <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>Сохранение…</Typography>}
        </Box>
        <IconButton size="small" onClick={onCancel}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2, color: '#546e7a' }}>
          Можно использовать Ctrl+S для сохранения. Редактирование для простых текстовых файлов (.txt, .md, .json, .csv, .log, .xml, .html, .js, .py).
        </DialogContentText>

        {visibleError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDismissedError(error || '')}>
            {visibleError}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box ref={gutterRef} sx={{
              width: 48,
              backgroundColor: '#f5f7fa',
              borderRadius: '6px',
              px: 1,
              py: 1,
              overflow: 'auto',
              textAlign: 'right',
              color: '#9e9e9e',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              userSelect: 'none'
            }}>
              {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
                <div key={i} style={{ height: '1.5rem' }}>{i + 1}</div>
              ))}
            </Box>

            <TextField
              inputRef={textareaRef}
              multiline
              minRows={16}
              fullWidth
              value={content}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Текст файла"
              variant="outlined"
              sx={{ fontFamily: 'monospace', '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
              onScroll={handleScroll}
            />
          </Box>
        )}

      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel}>Отмена</Button>
        <Button onClick={onSave} variant="contained" disabled={loading || saving}>
          {saving ? (<><CircularProgress size={16} sx={{ mr: 1 }} />Сохранение...</>) : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

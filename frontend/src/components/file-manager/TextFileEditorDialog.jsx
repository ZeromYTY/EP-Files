import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, Alert, CircularProgress, Typography } from '@mui/material';

export default function TextFileEditorDialog({ open, file, content, onChange, onSave, onCancel, loading, saving, error }) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>{file ? `Редактирование файла: ${file.name}` : 'Редактирование файла'}</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2, color: '#546e7a' }}>
          Внесите изменения в текстовый файл и сохраните их. Поддерживаются простые текстовые файлы с расширениями .txt, .md, .json, .csv, .log, .xml, .html, .js и .py.
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TextField
            multiline
            minRows={16}
            fullWidth
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Текст файла"
            variant="outlined"
            sx={{ fontFamily: 'Ubuntu, sans-serif' }}
          />
        )}

        {!loading && !content && file && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Файл пустой. Введите текст и нажмите «Сохранить».
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>Отмена</Button>
        <Button onClick={onSave} variant="contained" disabled={loading || saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

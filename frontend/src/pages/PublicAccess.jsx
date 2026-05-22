import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';
import { Download, Folder, InsertDriveFile } from '@mui/icons-material';
import api from '../api/axios';

const previewGroups = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'],
  video: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mpeg', 'mpg', 'avi'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'],
  text: ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'xml', 'csv', 'log', 'py', 'java', 'c', 'cpp', 'sh'],
};

function getPreviewType(fileName) {
  const extension = fileName?.split('.')?.pop()?.toLowerCase() || '';
  if (extension === 'pdf') return 'pdf';
  return Object.entries(previewGroups).find(([, extensions]) => extensions.includes(extension))?.[0] || 'unsupported';
}

function formatFileSize(bytes) {
  if (!bytes) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / (1024 ** index)).toFixed(1))} ${units[index]}`;
}

function triggerDownload(blobData, filename) {
  const blobUrl = window.URL.createObjectURL(new Blob([blobData]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

function PublicPreview({ file, preview }) {
  const type = getPreviewType(file.name);
  const mediaSx = { maxWidth: '100%', maxHeight: '68vh', borderRadius: 2 };

  if (preview.loading) return <CircularProgress />;
  if (preview.error) return <Alert severity="error">{preview.error}</Alert>;
  if (type === 'image') return <Box component="img" src={preview.url} alt={file.name} sx={mediaSx} />;
  if (type === 'video') return <Box component="video" src={preview.url} controls sx={{ ...mediaSx, width: '100%', backgroundColor: '#000' }} />;
  if (type === 'audio') return <Box component="audio" src={preview.url} controls sx={{ width: '100%' }} />;
  if (type === 'pdf') return <Box component="object" data={preview.url} type="application/pdf" sx={{ width: '100%', height: '68vh' }} />;
  if (type === 'text') return <Box component="pre" sx={{ width: '100%', maxHeight: '68vh', overflow: 'auto', m: 0, p: 2, borderRadius: 2, backgroundColor: '#fff', whiteSpace: 'pre-wrap' }}>{preview.content}</Box>;
  return <Typography color="text.secondary">Предпросмотр недоступен, файл можно скачать.</Typography>;
}

function PublicFilePage({ token }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState({ loading: true, error: '', url: '', content: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;

    async function loadFile() {
      try {
        setError('');
        const metaResponse = await api.get(`/public/files/${token}/?meta=1`);
        if (cancelled) return;
        const nextFile = metaResponse.data;
        setFile(nextFile);

        const type = getPreviewType(nextFile.name);
        if (type === 'unsupported') {
          setPreview({ loading: false, error: '', url: '', content: '' });
          return;
        }

        const response = await api.get(`/public/files/${token}/`, { responseType: type === 'text' ? 'text' : 'blob' });
        if (cancelled) return;
        if (type === 'text') setPreview({ loading: false, error: '', url: '', content: response.data });
        else {
          objectUrl = window.URL.createObjectURL(response.data);
          setPreview({ loading: false, error: '', url: objectUrl, content: '' });
        }
      } catch {
        if (!cancelled) {
          setError('Публичная ссылка недоступна или была отключена');
          setPreview({ loading: false, error: '', url: '', content: '' });
        }
      }
    }

    loadFile();
    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  const download = async () => {
    const response = await api.get(`/public/files/${token}/`, { responseType: 'blob' });
    triggerDownload(response.data, file?.name || 'file');
  };

  return (
    <PublicShell title={file?.name || 'Публичный файл'} error={error}>
      {file && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', mb: 2 }}>
            <Typography color="text.secondary">{formatFileSize(file.size)}</Typography>
            <Button variant="contained" startIcon={<Download />} onClick={download}>Скачать</Button>
          </Box>
          <Box sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 2, p: 2 }}>
            <PublicPreview file={file} preview={preview} />
          </Box>
        </>
      )}
    </PublicShell>
  );
}

function PublicFolderPage({ token }) {
  const [folderData, setFolderData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadFolder() {
      try {
        const response = await api.get(`/public/folders/${token}/`);
        setFolderData(response.data);
      } catch {
        setError('Публичная ссылка недоступна или была отключена');
      }
    }
    loadFolder();
  }, [token]);

  const files = folderData?.files || [];
  const folders = folderData?.folders || [];

  return (
    <PublicShell title={folderData?.folder?.name || 'Публичная папка'} error={error}>
      {folderData && (
        <List disablePadding sx={{ border: '1px solid #e5eaf1', borderRadius: 2, overflow: 'hidden' }}>
          {folders.map((folder) => (
            <ListItem key={`folder-${folder.id}`} sx={{ borderBottom: '1px solid #eef2f7' }}>
              <Folder sx={{ mr: 1.5, color: '#d08a22' }} />
              <ListItemText primary={folder.name} secondary="Папка" />
            </ListItem>
          ))}
          {files.map((file) => (
            <ListItem
              key={`file-${file.id}`}
              secondaryAction={<Button href={file.download_url} startIcon={<Download />}>Скачать</Button>}
              sx={{ borderBottom: '1px solid #eef2f7', '&:last-child': { borderBottom: 0 } }}
            >
              <InsertDriveFile sx={{ mr: 1.5, color: '#5274a3' }} />
              <ListItemText primary={file.name} secondary={formatFileSize(file.size)} />
            </ListItem>
          ))}
          {files.length === 0 && folders.length === 0 && <ListItem><ListItemText primary="Папка пустая" /></ListItem>}
        </List>
      )}
    </PublicShell>
  );
}

function PublicShell({ title, error, children }) {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f1f5f9', py: 5 }}>
      <Container maxWidth="md">
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <Typography variant="overline" color="text.secondary">EP Files</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, overflowWrap: 'anywhere' }}>{title}</Typography>
          {error ? <Alert severity="error">{error}</Alert> : children || <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>}
        </Paper>
      </Container>
    </Box>
  );
}

export default function PublicAccess() {
  const { token, resourceType } = useParams();
  const isFolder = useMemo(() => resourceType === 'folders', [resourceType]);
  return isFolder ? <PublicFolderPage token={token} /> : <PublicFilePage token={token} />;
}

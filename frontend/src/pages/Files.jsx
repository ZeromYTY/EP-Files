import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LogoutIcon from '@mui/icons-material/Logout';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export default function Files() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }
    loadFiles();
  }, [navigate]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      // Note: You'll need to add a GET endpoint to fetch user files
      // For now, this is a placeholder
      setFiles([]);
    } catch (err) {
      setError('Ошибка при загрузке файлов');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_BASE_URL}/upload/`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      // Add the new file to the list
      const newFile = {
        id: response.data.file_id,
        name: response.data.file_name,
        size: response.data.file_size,
      };

      setFiles([newFile, ...files]);
      e.target.value = ''; // Reset input
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при загрузке файла');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const handleDownload = (fileId, fileName) => {
    const token = localStorage.getItem('access_token');
    // Create a download link
    window.location.href = `http://localhost:8000/api/download/${fileId}/`;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Мои файлы</Typography>
        <Button
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          color="error"
        >
          Выход
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="contained"
            component="label"
            disabled={uploading}
          >
            {uploading ? <CircularProgress size={24} /> : 'Загрузить файл'}
            <input
              hidden
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </Button>
          <Typography variant="body2" color="textSecondary">
            Максимальный размер: 100 MB
          </Typography>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : files.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary">
            У вас пока нет файлов. Загрузите первый файл!
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>Имя файла</TableCell>
                <TableCell align="right">Размер</TableCell>
                <TableCell align="center">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>{file.name}</TableCell>
                  <TableCell align="right">{formatFileSize(file.size)}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(file.id, file.name)}
                      title="Скачать"
                    >
                      <DownloadIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}
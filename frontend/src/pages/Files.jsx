import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { Folder, InsertDriveFile } from '@mui/icons-material';

// Пример данных (замените на реальный API запрос)
const mockFiles = [
  { id: 1, name: 'Документы', type: 'folder' },
  { id: 2, name: 'Фотографии', type: 'folder' },
  { id: 3, name: 'report.pdf', type: 'file' },
  { id: 4, name: 'image.jpg', type: 'file' },
];

export default function Files() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4, mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Мои файлы</Typography>
          <Button variant="outlined" color="error" onClick={handleLogout}>
            Выйти
          </Button>
        </Box>

        <Alert severity="success" sx={{ mb: 3 }}>
          Вы вошли как: {user?.email || user?.name || 'Пользователь'}
        </Alert>

        <Typography variant="h6" gutterBottom>
          Файлы и папки
        </Typography>

        <List>
          {mockFiles.map((item, index) => (
            <ListItem key={item.id}>
              {item.type === 'folder' ? (
                <Folder color="primary" sx={{ mr: 2 }} />
              ) : (
                <InsertDriveFile color="action" sx={{ mr: 2 }} />
              )}
              <ListItemText primary={item.name} />
              {index < mockFiles.length - 1 && <Divider />}
            </ListItem>
          ))}
        </List>
      </Paper>
    </Container>
  );
}
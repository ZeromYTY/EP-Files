import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Paper,
} from '@mui/material';
import {
  Search,
  Description,
  Folder,
  Login as LoginIcon,
  PersonAdd,
} from '@mui/icons-material';

// Пример данных
const mockDocuments = [
  { id: 1, title: 'Презентация проекта', type: 'doc', updated: '2 часа назад', author: 'Вы' },
  { id: 2, title: 'Отчёт за квартал', type: 'doc', updated: 'Вчера', author: 'Вы' },
  { id: 3, title: 'Бюджет 2024', type: 'sheet', updated: '3 дня назад', author: 'Вы' },
  { id: 4, title: 'План развития', type: 'doc', updated: 'Неделю назад', author: 'Команда' },
  { id: 5, title: 'Список сотрудников', type: 'sheet', updated: '2 недели назад', author: 'HR' },
  { id: 6, title: 'Техническое задание', type: 'doc', updated: 'Месяц назад', author: 'Вы' },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocuments = mockDocuments.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
      {/* 🔵 HEADER */}
      <Box
        sx={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e0e0e0',
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        {/* 🖼️ ЛОГОТИП СЛЕВА */}
        <Box 
          component={Link} 
          to="/"
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5,
            textDecoration: 'none',
          }}
        >
          {/* Ваш нарисованный логотип */}
          <img
            src="/logo.png"
            alt="ep-files logo"
            style={{ 
              height: 40,
              width: 'auto',
              objectFit: 'contain',
            }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: '#2196F3',
              fontSize: '1.5rem',
            }}
          >
            ep-files
          </Typography>
        </Box>

        {/* 🔍 ПОИСК ПО ЦЕНТРУ */}
        <Box sx={{ flex: 1, maxWidth: 600, mx: 4 }}>
          <TextField
            fullWidth
            placeholder="Поиск документов..."
            size="medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#9e9e9e' }} />
                </InputAdornment>
              ),
              sx: {
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: 'none' },
              },
            }}
          />
        </Box>

        {/* 🔘 КНОПКИ СПРАВА */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!user ? (
            <>
              <Button
                variant="outlined"
                component={Link}
                to="/login"
                startIcon={<LoginIcon />}
                sx={{
                  borderColor: '#2196F3',
                  color: '#2196F3',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 3,
                  '&:hover': {
                    borderColor: '#1976D2',
                    backgroundColor: 'rgba(33, 150, 243, 0.04)',
                  },
                }}
              >
                Вход
              </Button>
              <Button
                variant="contained"
                component={Link}
                to="/register"
                startIcon={<PersonAdd />}
                sx={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 3,
                  '&:hover': {
                    backgroundColor: '#1976D2',
                  },
                }}
              >
                Регистрация
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                onClick={() => navigate('/files')}
                startIcon={<Folder />}
                sx={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 3,
                  '&:hover': { backgroundColor: '#1976D2' },
                }}
              >
                Мои файлы
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* 📁 MAIN CONTENT */}
      <Container maxWidth="lg" sx={{ py: 5 }}>
        {/* Заголовок */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 700, color: '#202124', mb: 1 }}>
            Добро пожаловать в ep-files
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Войдите, чтобы создавать и редактировать документы
          </Typography>
        </Box>

        {/* CTA Section - Светло-голубой блок */}
        {!user && (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              mb: 5,
              borderRadius: '16px',
              backgroundColor: '#e3f2fd',
              textAlign: 'center',
              border: '1px solid #bbdefb',
            }}
          >
            <Description sx={{ fontSize: 64, color: '#2196F3', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: '#202124' }}>
              Начните работать с документами прямо сейчас
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Создавайте, редактируйте и делитесь файлами вместе с командой
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                component={Link}
                to="/register"
                size="large"
                sx={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  '&:hover': { backgroundColor: '#1976D2' },
                }}
              >
                Создать аккаунт
              </Button>
              <Button
                variant="outlined"
                component={Link}
                to="/login"
                size="large"
                sx={{
                  borderColor: '#2196F3',
                  color: '#2196F3',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  '&:hover': { borderColor: '#1976D2', backgroundColor: 'rgba(33, 150, 243, 0.04)' },
                }}
              >
                Войти
              </Button>
            </Box>
          </Paper>
        )}

        {/* Примеры документов */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Description sx={{ color: '#2196F3', fontSize: 24 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#202124' }}>
              Примеры документов
            </Typography>
            <Box
              sx={{
                backgroundColor: '#e0e0e0',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {filteredDocuments.length}
            </Box>
          </Box>

          <Paper
            elevation={0}
            sx={{
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              overflow: 'hidden',
              backgroundColor: '#fff',
            }}
          >
            {filteredDocuments.map((doc, index) => (
              <Box
                key={doc.id}
                sx={{
                  p: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  '&:hover': { backgroundColor: '#f5f8ff' },
                  ...(index < filteredDocuments.length - 1 && {
                    borderBottom: '1px solid #f0f0f0',
                  }),
                }}
                onClick={() => user && navigate('/files')}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '8px',
                    backgroundColor: doc.type === 'sheet' ? '#e8f5e9' : '#e3f2fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Description sx={{ color: doc.type === 'sheet' ? '#4CAF50' : '#2196F3' }} />
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 500, color: '#202124', mb: 0.5 }}
                  >
                    {doc.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {doc.author} • {doc.updated}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    backgroundColor: doc.type === 'sheet' ? '#e8f5e9' : '#e3f2fd',
                    color: doc.type === 'sheet' ? '#4CAF50' : '#2196F3',
                    px: 2,
                    py: 0.75,
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  {doc.type === 'sheet' ? 'Таблица' : 'Документ'}
                </Box>
              </Box>
            ))}
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
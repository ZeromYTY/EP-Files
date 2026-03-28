import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Button,
  Grid,
  Paper,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Divider,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Search,
  Add,
  Description,
  TableChart,
  Folder,
  MoreVert,
  Star,
  AccessTime,
  Person,
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCreateClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDocumentIcon = (type) => {
    return type === 'sheet' ? <TableChart /> : <Description />;
  };

  const getDocumentColor = (type) => {
    return type === 'sheet' ? '#4CAF50' : '#2196F3';
  };

  const filteredDocuments = mockDocuments.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* 🔵 HEADER */}
      <Box
        sx={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e0e0e0',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        {/* Логотип + Название */}
        <Box 
          component={Link} 
          to="/"
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            textDecoration: 'none'
          }}
        >
          <img
            src="/logo.png"
            alt="ep-files logo"
            style={{ height: 40, width: 'auto' }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: '#2196F3',
              fontSize: '1.5rem',
            }}
          >
            ep-files
          </Typography>
        </Box>

        {/* Поиск */}
        <Box sx={{ flex: 1, maxWidth: 600, mx: 4 }}>
          <TextField
            fullWidth
            placeholder="Поиск документов..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#9e9e9e' }} />
                </InputAdornment>
              ),
              sx: {
                backgroundColor: '#f1f3f4',
                borderRadius: '8px',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
              },
            }}
          />
        </Box>

        {/* 🔘 Кнопки справа */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!user ? (
            /* 👤 НЕ АВТОРИЗОВАН — показываем Вход/Регистрация */
            <>
              <Button
                variant="outlined"
                component={Link}
                to="/login"
                startIcon={<LoginIcon />}
                sx={{
                  borderColor: '#2196F3',
                  color: '#2196F3',
                  fontWeight: 500,
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
                  fontWeight: 500,
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                  '&:hover': {
                    backgroundColor: '#1976D2',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
                  },
                }}
              >
                Регистрация
              </Button>
            </>
          ) : (
            /* ✅ АВТОРИЗОВАН — показываем профиль и выход */
            <>
              <Button
                variant="contained"
                component={Link}
                to="/files"
                startIcon={<Folder />}
                sx={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  fontWeight: 500,
                  '&:hover': { backgroundColor: '#1976D2' },
                }}
              >
                Мои файлы
              </Button>
              
              <Tooltip title={user?.email || 'Пользователь'}>
                <IconButton sx={{ backgroundColor: '#2196F3', color: '#fff' }}>
                  <Person />
                </IconButton>
              </Tooltip>
              
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleLogout}
                startIcon={<LoginIcon />}
              >
                Выйти
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* 📁 MAIN CONTENT */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Заголовок + Кнопка создания */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 4,
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#202124' }}>
              {user ? 'Мои документы' : 'Добро пожаловать в ep-files'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {user 
                ? 'Быстрый доступ к вашим файлам' 
                : 'Войдите, чтобы создавать и редактировать документы'}
            </Typography>
          </Box>

          {user && (
            <>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateClick}
                sx={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  px: 3,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 500,
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                  '&:hover': {
                    backgroundColor: '#1976D2',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
                  },
                }}
              >
                Создать
              </Button>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCreateClose}
                PaperProps={{
                  sx: { borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' },
                }}
              >
                <MenuItem onClick={handleCreateClose}>
                  <Description sx={{ color: '#2196F3', mr: 2 }} />
                  Документ
                </MenuItem>
                <MenuItem onClick={handleCreateClose}>
                  <TableChart sx={{ color: '#4CAF50', mr: 2 }} />
                  Таблица
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleCreateClose}>
                  <Folder sx={{ color: '#FF9800', mr: 2 }} />
                  Папка
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        {/* 🔹 Быстрый доступ (только для авторизованных) */}
        {user && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Star sx={{ color: '#FFC107', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Быстрый доступ
              </Typography>
            </Box>

            <Grid container spacing={2}>
              {filteredDocuments.slice(0, 4).map((doc) => (
                <Grid item xs={12} sm={6} md={3} key={doc.id}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        transform: 'translateY(-2px)',
                        borderColor: '#2196F3',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '8px',
                        backgroundColor: `${getDocumentColor(doc.type)}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                      }}
                    >
                      {getDocumentIcon(doc.type)}
                    </Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 500,
                        mb: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTime sx={{ fontSize: 14, color: '#9e9e9e' }} />
                      <Typography variant="caption" color="text.secondary">
                        {doc.updated}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* 🔹 Информация для неавторизованных */}
        {!user && (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 4,
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              backgroundColor: '#e3f2fd',
              textAlign: 'center',
            }}
          >
            <Description sx={{ fontSize: 48, color: '#2196F3', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
              Начните работать с документами прямо сейчас
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
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
                  px: 4,
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
                  px: 4,
                  '&:hover': { borderColor: '#1976D2' },
                }}
              >
                Войти
              </Button>
            </Box>
          </Paper>
        )}

        {/* 🔹 Недавние документы */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Description sx={{ color: '#2196F3', fontSize: 20 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {user ? 'Недавние документы' : 'Примеры документов'}
            </Typography>
            <Chip label={filteredDocuments.length} size="small" sx={{ ml: 1 }} />
          </Box>

          <Paper
            elevation={0}
            sx={{
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              overflow: 'hidden',
            }}
          >
            {filteredDocuments.map((doc, index) => (
              <Box
                key={doc.id}
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  cursor: user ? 'pointer' : 'default',
                  transition: 'background-color 0.2s ease',
                  '&:hover': user ? { backgroundColor: '#f5f8ff' } : {},
                  ...(index < filteredDocuments.length - 1 && {
                    borderBottom: '1px solid #f0f0f0',
                  }),
                }}
                onClick={() => user && navigate('/files')}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '6px',
                    backgroundColor: `${getDocumentColor(doc.type)}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: getDocumentColor(doc.type),
                  }}
                >
                  {getDocumentIcon(doc.type)}
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 500, color: '#202124' }}
                  >
                    {doc.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {doc.author} • {doc.updated}
                  </Typography>
                </Box>

                <Chip
                  label={doc.type === 'sheet' ? 'Таблица' : 'Документ'}
                  size="small"
                  sx={{
                    backgroundColor: `${getDocumentColor(doc.type)}15`,
                    color: getDocumentColor(doc.type),
                    fontWeight: 500,
                  }}
                />

                {user && (
                  <IconButton size="small">
                    <MoreVert sx={{ color: '#9e9e9e' }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Box,
} from '@mui/material';

// Схема валидации
const schema = yup.object({
  email: yup
    .string()
    .email('Введите корректный email')
    .required('Email обязателен'),
  password: yup
    .string()
    .min(6, 'Минимум 6 символов')
    .required('Пароль обязателен'),
}).required();

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    try {
      setError('');
      await login(data.email, data.password);
      navigate('/files');
    } catch (err) {
      const serverError =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.response?.data?.detail;

      setError(
        serverError === 'Invalid credentials'
          ? 'Неверный email или пароль'
          : serverError || 'Неверный email или пароль'
      );
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Вход
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            fullWidth
            label="Email"
            type="email"
            margin="normal"
            autoComplete="email"
            {...register('email')}
            error={!!errors.email}
            helperText={errors.email?.message}
          />

          <TextField
            fullWidth
            label="Пароль"
            type="password"
            margin="normal"
            autoComplete="current-password"
            {...register('password')}
            error={!!errors.password}
            helperText={errors.password?.message}
          />

          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            sx={{ mt: 3, mb: 2 }}
          >
            {isSubmitting ? 'Вход...' : 'Войти'}
          </Button>

          <Typography align="center" color="text.secondary">
            Нет аккаунта?{' '}
            <Link to="/register" style={{ textDecoration: 'none' }}>
              Зарегистрироваться
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
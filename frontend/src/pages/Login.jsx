import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../context/authContextValue';
import { useNavigate, Link } from 'react-router-dom';
import { Alert, Box, Button, Container, Paper, TextField, Typography } from '@mui/material';

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

function getLoginError(err) {
  const serverError = err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail;
  return serverError === 'Invalid credentials'
    ? 'Неверный email или пароль'
    : serverError || 'Неверный email или пароль';
}

function LoginForm({ register, errors, isSubmitting, onSubmit, handleSubmit, error }) {
  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <TextField fullWidth label="Email" type="email" margin="normal" autoComplete="email" {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
      <TextField fullWidth label="Пароль" type="password" margin="normal" autoComplete="current-password" {...register('password')} error={!!errors.password} helperText={errors.password?.message} />
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <Button fullWidth type="submit" variant="contained" size="large" disabled={isSubmitting} sx={{ mt: 3, mb: 2 }}>
        {isSubmitting ? 'Вход...' : 'Войти'}
      </Button>
      <Typography align="center" color="text.secondary">
        Нет аккаунта? <Link to="/register" style={{ textDecoration: 'none' }}>Зарегистрироваться</Link>
      </Typography>
    </Box>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(() => {
    const authError = sessionStorage.getItem('auth_error');
    if (authError) {
      sessionStorage.removeItem('auth_error');
      return authError;
    }
    return '';
  });

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
      await login(data.email.trim(), data.password);
      navigate('/files');
    } catch (err) {
      setError(getLoginError(err));
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">Вход</Typography>
        <LoginForm register={register} errors={errors} isSubmitting={isSubmitting} onSubmit={onSubmit} handleSubmit={handleSubmit} error={error} />
      </Paper>
    </Container>
  );
}

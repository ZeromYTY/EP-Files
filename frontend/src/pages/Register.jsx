import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../context/authContextValue';
import { useNavigate, Link } from 'react-router-dom';
import { Alert, Box, Button, Container, Paper, TextField, Typography } from '@mui/material';
const schema = yup.object({
  name: yup
    .string()
    .min(2, 'Минимум 2 символа')
    .max(50, 'Максимум 50 символов')
    .required('Имя обязательно'),
  email: yup
    .string()
    .email('Введите корректный email')
    .required('Email обязателен'),
  password: yup
    .string()
    .min(6, 'Минимум 6 символов')
    .required('Пароль обязателен'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Пароли должны совпадать')
    .required('Подтвердите пароль'),
}).required();

function getRegisterErrorMessage(err) {
  const responseData = err.response?.data;
  if (!responseData) return 'Ошибка при регистрации';
  if (responseData.error || responseData.message || responseData.detail) {
    return responseData.error || responseData.message || responseData.detail;
  }
  const fieldLabels = { name: 'Имя', email: 'Email', password: 'Пароль', non_field_errors: 'Ошибка' };
  const messages = Object.entries(responseData).map(([field, value]) => `${fieldLabels[field] || field}: ${Array.isArray(value) ? value.join(' ') : value}`).join('\n');
  return messages || 'Ошибка при регистрации';
}

function RegisterForm({ register, errors, isSubmitting, onSubmit, handleSubmit, error }) {
  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {error && <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{error}</Alert>}
      <TextField fullWidth label="Имя" margin="normal" autoComplete="name" {...register('name')} error={!!errors.name} helperText={errors.name?.message} />
      <TextField fullWidth label="Email" type="email" margin="normal" autoComplete="email" {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
      <TextField fullWidth label="Пароль" type="password" margin="normal" autoComplete="new-password" {...register('password')} error={!!errors.password} helperText={errors.password?.message} />
      <TextField fullWidth label="Подтвердите пароль" type="password" margin="normal" autoComplete="new-password" {...register('confirmPassword')} error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message} />
      <Button fullWidth type="submit" variant="contained" size="large" disabled={isSubmitting} sx={{ mt: 3, mb: 2 }}>{isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}</Button>
      <Typography align="center" color="text.secondary">Уже есть аккаунт? <Link to="/login" style={{ textDecoration: 'none' }}>Войти</Link></Typography>
    </Box>
  );
}

export default function Register() {
  const { register: registerUser } = useAuth();
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
      await registerUser(data.name, data.email, data.password);
      navigate('/files');
    } catch (err) {
      setError(getRegisterErrorMessage(err));
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">Регистрация</Typography>
        <RegisterForm register={register} errors={errors} isSubmitting={isSubmitting} onSubmit={onSubmit} handleSubmit={handleSubmit} error={error} />
      </Paper>
    </Container>
  );
}

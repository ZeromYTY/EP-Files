import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import { CheckCircle, ErrorOutline, HourglassEmpty } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

const activeStatuses = new Set(['uploading', 'downloading', 'deleting']);

function getStatusConfig(task, theme) {
  if (task.status === 'success') {
    return {
      color: theme.palette.success.main,
      bg: alpha(theme.palette.success.main, 0.1),
      border: alpha(theme.palette.success.main, 0.28),
      label: 'Готово',
      icon: <CheckCircle fontSize="small" />,
    };
  }
  if (task.status === 'error') {
    return {
      color: theme.palette.error.main,
      bg: alpha(theme.palette.error.main, 0.1),
      border: alpha(theme.palette.error.main, 0.3),
      label: 'Ошибка',
      icon: <ErrorOutline fontSize="small" />,
    };
  }
  return {
    color: theme.palette.primary.main,
    bg: alpha(theme.palette.primary.main, 0.1),
    border: alpha(theme.palette.primary.main, 0.24),
    label: task.status === 'uploading' ? `${Math.round(task.progress || 0)}%` : 'В процессе',
    icon: <HourglassEmpty fontSize="small" />,
  };
}

export default function TaskStatusItem({ task }) {
  const theme = useTheme();
  const isActive = activeStatuses.has(task.status);
  const config = getStatusConfig(task, theme);
  return (
    <Box
      sx={{
          p: 1.5,
          display: 'grid',
          gridTemplateColumns: '36px minmax(0, 1fr)',
          gap: 1.25,
          borderRadius: '10px',
          border: '1px solid',
          borderColor: config.border,
          backgroundColor: config.bg,
          boxShadow: task.status === 'error' ? `0 10px 24px ${alpha(theme.palette.error.main, 0.08)}` : 'none',
      }}
    >
      <Box
        sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            color: config.color,
            backgroundColor: alpha(config.color, 0.12),
        }}
      >
        {isActive ? <CircularProgress variant={task.status === 'uploading' ? 'determinate' : 'indeterminate'} value={task.status === 'uploading' ? task.progress : undefined} size={22} thickness={4.5} color="inherit" /> : config.icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</Typography>
          <Typography variant="caption" sx={{ color: config.color, fontWeight: 800, flexShrink: 0 }}>
            {config.label}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.35 }}>
          {task.subText || task.title}
        </Typography>
        {task.status === 'uploading' && (
          <LinearProgress
            variant="determinate"
            value={task.progress || 0}
            sx={{ mt: 1, height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}
          />
        )}
      </Box>
    </Box>
  );
}

import { Avatar, Box, Button, Typography } from '@mui/material';

function getInitial(user) {
  return (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();
}

export default function HeaderProfileButton({ user, sx, ...props }) {
  return (
    <Button
      variant="outlined"
      sx={{
        minWidth: { xs: 48, sm: 170 },
        height: 40,
        whiteSpace: 'nowrap',
        px: { xs: 0.75, sm: 1.5 },
        backgroundColor: 'rgba(68, 215, 182, 0.08)',
        '&:hover': { backgroundColor: 'rgba(68, 215, 182, 0.14)' },
        ...sx,
      }}
      {...props}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 0, sm: 1 }, minWidth: 0 }}>
        <Avatar
          src={user?.avatar_url || undefined}
          sx={{
            width: 24,
            height: 24,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            border: '1px solid',
            borderColor: 'background.paper',
            fontSize: '0.72rem',
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {getInitial(user)}
        </Avatar>
        <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: '0.875rem', fontWeight: 700 }}>
          Личный кабинет
        </Typography>
      </Box>
    </Button>
  );
}

import { Box, CircularProgress, Typography } from '@mui/material';
import { Folder } from '@mui/icons-material';

export default function LoadingScreen({ label = 'Загрузка' }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: (theme) => theme.ep.pageGradient,
      }}
    >
      <Box
        className="ep-scale-in"
        sx={{
          width: 128,
          height: 128,
          borderRadius: '24px',
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: (theme) => theme.ep.panel,
          boxShadow: (theme) => theme.ep.shadow,
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          animation: 'epFloat 3.2s ease-in-out infinite',
        }}
      >
        <CircularProgress
          size={86}
          thickness={2.4}
          sx={{ color: 'primary.main', position: 'absolute' }}
        />
        <Folder sx={{ fontSize: 42, color: 'secondary.main', animation: 'epSoftPulse 2.4s ease-in-out infinite' }} />
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            bottom: -30,
            color: 'text.secondary',
            fontWeight: 700,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

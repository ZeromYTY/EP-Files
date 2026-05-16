import { Box, Typography } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';

export default function Breadcrumbs({ path, onBreadcrumbClick }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
      {path.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
          {index > 0 && <ChevronRight sx={{ fontSize: 16, color: '#9e9e9e', mx: 0.5 }} />}
          <Typography
            component="span"
            onClick={() => onBreadcrumbClick(item.id)}
            sx={{
              color: index === path.length - 1 ? '#202124' : '#2196F3',
              fontWeight: index === path.length - 1 ? 600 : 400,
              cursor: index === path.length - 1 ? 'default' : 'pointer',
              fontSize: '0.95rem',
              '&:hover': { color: index === path.length - 1 ? '#202124' : '#1976D2' },
            }}
          >
            {item.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
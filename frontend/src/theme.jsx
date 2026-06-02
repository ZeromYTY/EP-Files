import { useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { alpha, createTheme } from '@mui/material/styles';
import { ThemeModeContext } from './themeMode';

const THEME_STORAGE_KEY = 'ep_theme_mode';
const themeModes = new Set(['light', 'dark']);

function modeTokens(mode) {
  const dark = mode === 'dark';
  return {
    dark,
    primary: dark ? '#44d7b6' : '#0f766e',
    primaryLight: dark ? '#83f0d7' : '#14b8a6',
    primaryDark: dark ? '#16a489' : '#0f5f58',
    secondary: dark ? '#f4b95f' : '#b7791f',
    secondaryLight: dark ? '#ffd894' : '#f6c76e',
    secondaryDark: dark ? '#bd7f24' : '#7c4f12',
    page: dark ? '#0b0d10' : '#f5f7fb',
    paper: dark ? '#121417' : '#ffffff',
    elevated: dark ? '#191d22' : '#ffffff',
    header: dark ? 'rgba(18, 20, 23, 0.86)' : 'rgba(255, 255, 255, 0.86)',
    panel: dark ? 'rgba(25, 29, 34, 0.88)' : 'rgba(255, 255, 255, 0.9)',
    subtle: dark ? 'rgba(255,255,255,0.035)' : 'rgba(15, 23, 42, 0.035)',
    hover: dark ? 'rgba(255,255,255,0.045)' : 'rgba(15, 23, 42, 0.045)',
    line: dark ? 'rgba(236, 244, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)',
    text: dark ? '#f4f7fb' : '#101828',
    textSecondary: dark ? '#9aa7b7' : '#64748b',
    shadow: dark ? '0 18px 48px rgba(0, 0, 0, 0.28)' : '0 18px 48px rgba(15, 23, 42, 0.1)',
    menuShadow: dark ? '0 18px 48px rgba(0, 0, 0, 0.42)' : '0 18px 48px rgba(15, 23, 42, 0.16)',
    pageGradient: dark
      ? 'radial-gradient(circle at 18% 0%, rgba(68, 215, 182, 0.16), transparent 28%), radial-gradient(circle at 100% 10%, rgba(244, 185, 95, 0.12), transparent 24%), #0b0d10'
      : 'radial-gradient(circle at 18% 0%, rgba(20, 184, 166, 0.14), transparent 28%), radial-gradient(circle at 100% 10%, rgba(246, 199, 110, 0.16), transparent 24%), #f5f7fb',
  };
}

function createAppTheme(mode) {
  const tokens = modeTokens(mode);
  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: tokens.primary,
        light: tokens.primaryLight,
        dark: tokens.primaryDark,
        contrastText: mode === 'dark' ? '#06110f' : '#ffffff',
      },
      secondary: {
        main: tokens.secondary,
        light: tokens.secondaryLight,
        dark: tokens.secondaryDark,
        contrastText: mode === 'dark' ? '#181006' : '#ffffff',
      },
      error: {
        main: mode === 'dark' ? '#ff6b7a' : '#dc2626',
      },
      warning: {
        main: tokens.secondary,
      },
      success: {
        main: mode === 'dark' ? '#4ade80' : '#16a34a',
      },
      background: {
        default: tokens.page,
        paper: tokens.paper,
      },
      text: {
        primary: tokens.text,
        secondary: tokens.textSecondary,
      },
      divider: tokens.line,
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: "'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
      h5: { letterSpacing: 0 },
      button: { letterSpacing: 0, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '@keyframes epFadeUp': {
            from: {
              opacity: 0,
              transform: 'translate3d(0, 14px, 0)',
            },
            to: {
              opacity: 1,
              transform: 'translate3d(0, 0, 0)',
            },
          },
          '@keyframes epScaleIn': {
            from: {
              opacity: 0,
              transform: 'scale(0.98)',
            },
            to: {
              opacity: 1,
              transform: 'scale(1)',
            },
          },
          '@keyframes epSoftPulse': {
            '0%, 100%': {
              transform: 'scale(1)',
              boxShadow: `0 0 0 0 ${alpha(tokens.primary, 0.22)}`,
            },
            '50%': {
              transform: 'scale(1.04)',
              boxShadow: `0 0 0 12px ${alpha(tokens.primary, 0)}`,
            },
          },
          '@keyframes epFloat': {
            '0%, 100%': {
              transform: 'translate3d(0, 0, 0)',
            },
            '50%': {
              transform: 'translate3d(0, -6px, 0)',
            },
          },
          body: {
            background: tokens.pageGradient,
            color: tokens.text,
            transition: 'background 220ms ease, color 220ms ease',
          },
          '.ep-page': {
            animation: 'epFadeUp 460ms cubic-bezier(0.22, 1, 0.36, 1) both',
          },
          '.ep-animate-in': {
            animation: 'epFadeUp 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
          },
          '.ep-scale-in': {
            animation: 'epScaleIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
          },
          '.ep-stagger > *': {
            animation: 'epFadeUp 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
          },
          '.ep-stagger > *:nth-of-type(2)': {
            animationDelay: '70ms',
          },
          '.ep-stagger > *:nth-of-type(3)': {
            animationDelay: '140ms',
          },
          '.ep-stagger > *:nth-of-type(4)': {
            animationDelay: '210ms',
          },
          '.ep-stagger > *:nth-of-type(5)': {
            animationDelay: '280ms',
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.001ms !important',
              animationIterationCount: '1 !important',
              scrollBehavior: 'auto !important',
              transitionDuration: '0.001ms !important',
            },
          },
          '::selection': {
            backgroundColor: alpha(tokens.primary, 0.32),
          },
          '::-webkit-scrollbar-track': {
            background: tokens.page,
          },
          '::-webkit-scrollbar-thumb': {
            background: mode === 'dark' ? '#323b46' : '#c7d0dc',
            borderRadius: 8,
          },
          '::-webkit-scrollbar-thumb:hover': {
            background: mode === 'dark' ? '#4b5968' : '#9aa8ba',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: tokens.paper,
            borderColor: tokens.line,
            transition: 'background-color 220ms ease, border-color 220ms ease, box-shadow 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            transition: 'border-color 220ms ease, box-shadow 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.elevated,
            border: `1px solid ${tokens.line}`,
            boxShadow: mode === 'dark' ? '0 24px 80px rgba(0, 0, 0, 0.55)' : '0 24px 80px rgba(15, 23, 42, 0.16)',
            animation: 'epScaleIn 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.elevated,
            border: `1px solid ${tokens.line}`,
            boxShadow: tokens.menuShadow,
            animation: 'epScaleIn 160ms cubic-bezier(0.22, 1, 0.36, 1) both',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            margin: '2px 6px',
            minHeight: 38,
            '&:hover': {
              backgroundColor: alpha(tokens.primary, 0.12),
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 700,
            transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0) scale(0.98)',
            },
            '&.Mui-disabled': {
              transform: 'none',
            },
          },
          outlined: {
            borderColor: tokens.line,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'background-color 180ms ease, color 180ms ease, box-shadow 180ms ease, opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0) scale(0.94)',
            },
            '&.Mui-disabled': {
              transform: 'none',
            },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            transition: 'filter 180ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
            '&:hover': {
              transform: 'translateY(-3px)',
            },
            '&:active': {
              transform: 'translateY(0) scale(0.98)',
            },
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? alpha('#ffffff', 0.045) : alpha('#0f172a', 0.035),
            '& fieldset': {
              borderColor: tokens.line,
            },
            '&:hover fieldset': {
              borderColor: alpha(tokens.primary, 0.55),
            },
            '&.Mui-focused fieldset': {
              borderColor: tokens.primary,
            },
          },
        },
      },
    },
  });

  theme.ep = tokens;
  return theme;
}

function getInitialMode() {
  const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
  if (themeModes.has(savedMode)) return savedMode;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState(getInitialMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({
    mode,
    followsSystem: !localStorage.getItem(THEME_STORAGE_KEY),
    toggleMode: () => {
      setMode((currentMode) => {
        const nextMode = currentMode === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_STORAGE_KEY, nextMode);
        return nextMode;
      });
    },
  }), [mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  useEffect(() => {
    if (localStorage.getItem(THEME_STORAGE_KEY)) return undefined;
    if (!window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemThemeChange = (event) => {
      setMode(event.matches ? 'light' : 'dark');
    };

    mediaQuery.addEventListener?.('change', handleSystemThemeChange);
    mediaQuery.addListener?.(handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener?.('change', handleSystemThemeChange);
      mediaQuery.removeListener?.(handleSystemThemeChange);
    };
  }, []);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

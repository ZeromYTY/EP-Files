import { useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { alpha, createTheme } from '@mui/material/styles';
import { ThemeModeContext } from './themeMode';

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
          body: {
            background: tokens.pageGradient,
            color: tokens.text,
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
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.elevated,
            border: `1px solid ${tokens.line}`,
            boxShadow: mode === 'dark' ? '0 24px 80px rgba(0, 0, 0, 0.55)' : '0 24px 80px rgba(15, 23, 42, 0.16)',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.elevated,
            border: `1px solid ${tokens.line}`,
            boxShadow: tokens.menuShadow,
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
          },
          outlined: {
            borderColor: tokens.line,
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
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState(getInitialMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({
    mode,
    followsSystem: true,
    toggleMode: () => {
      setMode((currentMode) => (currentMode === 'dark' ? 'light' : 'dark'));
    },
  }), [mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  useEffect(() => {
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

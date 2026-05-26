import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ContentCopy, DeleteOutline, Link as LinkIcon, PersonAdd, Public, Security } from '@mui/icons-material';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../pages/file-manager/fileManagerHelpers';

const permissionLabels = {
  read: 'Чтение',
  read_write: 'Чтение и запись',
};

const publicDurationOptions = [
  { value: '60', label: '1 час' },
  { value: '1440', label: '24 часа' },
  { value: '10080', label: '7 дней' },
  { value: '43200', label: '30 дней' },
  { value: 'never', label: 'Бессрочно' },
];

function getResourcePath(item, suffix = '') {
  if (!item) return '';
  const resourceType = item.type === 'folder' ? 'folders' : 'files';
  return `/${resourceType}/${item.id}${suffix}`;
}

function buildPublicUrl(item, token) {
  if (!item || !token) return '';
  const publicType = item.type === 'folder' ? 'folders' : 'files';
  return `${window.location.origin}/public/${publicType}/${token}`;
}

function getPermissionUser(permission) {
  return permission.user_name || permission.user_email || `Пользователь #${permission.user}`;
}

const editableTextExtensions = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'py'];

function isEditableFile(item) {
  if (item?.type !== 'file') return false;
  const extension = item.name?.split('.')?.pop()?.toLowerCase();
  return editableTextExtensions.includes(extension);
}

function getAvailablePermissionOptions(item) {
  if (item?.type === 'file' && !isEditableFile(item)) {
    return [{ value: 'read', label: 'Чтение' }];
  }
  return [
    { value: 'read', label: 'Чтение' },
    { value: 'read_write', label: 'Чтение и запись' },
  ];
}

function formatPublicExpiration(expiresAt) {
  if (!expiresAt) return 'без срока';
  return `до ${new Date(expiresAt).toLocaleString('ru-RU')}`;
}

function PermissionsList({ permissions, busy, onRevoke }) {
  if (permissions.length === 0) {
    return (
      <Box sx={{ py: 2.5, textAlign: 'center', color: 'text.secondary', border: '1px dashed', borderColor: 'divider', borderRadius: 2, backgroundColor: (theme) => theme.ep.subtle }}>
        <Typography variant="body2">Права другим пользователям не выданы</Typography>
      </Box>
    );
  }

  return (
    <List disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      {permissions.map((permission) => (
        <ListItem
          key={permission.id}
          secondaryAction={
            <Tooltip title="Отозвать права">
              <span>
                <IconButton edge="end" color="error" disabled={busy} onClick={() => onRevoke(permission)}>
                  <DeleteOutline />
                </IconButton>
              </span>
            </Tooltip>
          }
          sx={{ borderBottom: '1px solid', borderColor: 'divider', pr: 13, '&:last-child': { borderBottom: 0 }, '&:hover': { backgroundColor: (theme) => theme.ep.hover } }}
        >
          <ListItemText
            primary={getPermissionUser(permission)}
            secondary={permission.user_email}
            primaryTypographyProps={{ fontWeight: 700 }}
          />
          <Chip
            size="small"
            label={permissionLabels[permission.permission_type] || permission.permission_type_display}
            color={permission.permission_type === 'read_write' ? 'primary' : 'default'}
            sx={{ mr: 6 }}
          />
        </ListItem>
      ))}
    </List>
  );
}

function GrantPermissionForm({ item, email, setEmail, permissionType, setPermissionType, inherit, setInherit, busy, onSubmit }) {
  const permissionOptions = getAvailablePermissionOptions(item);
  const canInherit = item?.type === 'folder';
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 180px auto' }, gap: 1.5, alignItems: 'center' }}>
      <TextField
        size="small"
        label="Email пользователя"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="off"
      />
      <FormControl size="small">
        <InputLabel>Права</InputLabel>
        <Select label="Права" value={permissionType} onChange={(event) => setPermissionType(event.target.value)}>
          {permissionOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </Select>
      </FormControl>
      <Button variant="contained" startIcon={<PersonAdd />} disabled={busy || !email.trim()} onClick={onSubmit}>
        Выдать
      </Button>
      {canInherit && (
        <FormControlLabel
          sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' }, mt: -0.5 }}
          control={<Switch checked={inherit} onChange={(event) => setInherit(event.target.checked)} />}
          label="Наследовать для вложенных объектов"
        />
      )}
      {item?.type === 'file' && !isEditableFile(item) && (
        <Typography variant="caption" color="text.secondary" sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' }, mt: -1 }}>
          Для файлов без встроенного редактирования доступно только чтение.
        </Typography>
      )}
    </Box>
  );
}

function PublicLinkPanel({ item, publicToken, setPublicToken, publicExpiresAt, setPublicExpiresAt, duration, setDuration, busy, setBusy, setLocalError, setLocalSuccess, onChanged }) {
  const publicUrl = useMemo(() => buildPublicUrl(item, publicToken), [item, publicToken]);
  const isEnabled = Boolean(publicToken);

  const enableLink = async () => {
    setBusy(true);
    setLocalError('');
    try {
      const payload = duration === 'never' ? {} : { public_expires_in_minutes: Number(duration) };
      const response = await api.post(getResourcePath(item, '/public-link/'), payload);
      setPublicToken(response.data.public_token);
      setPublicExpiresAt(response.data.public_expires_at || '');
      setLocalSuccess(isEnabled ? 'Срок публичной ссылки обновлён' : 'Публичная ссылка включена');
      onChanged?.();
    } catch (err) {
      setLocalError(getApiErrorMessage(err, 'Не удалось включить публичную ссылку'));
    } finally {
      setBusy(false);
    }
  };

  const disableLink = async () => {
    setBusy(true);
    setLocalError('');
    try {
      await api.delete(getResourcePath(item, '/public-link/disable/'));
      setPublicToken('');
      setPublicExpiresAt('');
      setLocalSuccess('Публичная ссылка отключена');
      onChanged?.();
    } catch (err) {
      setLocalError(getApiErrorMessage(err, 'Не удалось отключить публичную ссылку'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLocalSuccess('Ссылка скопирована');
    } catch {
      setLocalError('Не удалось скопировать ссылку автоматически');
    }
  };

  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, backgroundColor: (theme) => theme.ep.subtle }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Public color={isEnabled ? 'success' : 'disabled'} />
          <Typography sx={{ fontWeight: 800 }}>Публичная ссылка</Typography>
          <Chip size="small" label={isEnabled ? 'Включена' : 'Отключена'} color={isEnabled ? 'success' : 'default'} />
        </Box>
        {isEnabled && <Typography variant="caption" color="text.secondary">Активна {formatPublicExpiration(publicExpiresAt)}</Typography>}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px, 220px) auto auto' }, gap: 1, alignItems: 'center', mb: isEnabled ? 1.5 : 0 }}>
        <FormControl size="small">
          <InputLabel>Срок действия</InputLabel>
          <Select label="Срок действия" value={duration} onChange={(event) => setDuration(event.target.value)}>
            {publicDurationOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" disabled={busy} onClick={enableLink}>
          {isEnabled ? 'Обновить срок' : 'Создать'}
        </Button>
        {isEnabled && <Button variant="outlined" color="error" disabled={busy} onClick={disableLink}>Отключить</Button>}
      </Box>
      {isEnabled && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" value={publicUrl} fullWidth InputProps={{ readOnly: true, startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary' }} /> }} />
          <Tooltip title="Скопировать">
            <span>
              <IconButton color="primary" disabled={busy} onClick={copyLink}>
                <ContentCopy />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

export default function AccessControlDialog({ open, item, onClose, onChanged }) {
  const [permissions, setPermissions] = useState([]);
  const [email, setEmail] = useState('');
  const [permissionType, setPermissionType] = useState('read');
  const [inherit, setInherit] = useState(true);
  const [publicToken, setPublicToken] = useState('');
  const [publicExpiresAt, setPublicExpiresAt] = useState('');
  const [publicDuration, setPublicDuration] = useState('1440');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  const loadPermissions = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    setLocalError('');
    try {
      const response = await api.get(getResourcePath(item, '/permissions/'));
      setPermissions(response.data.permissions || []);
    } catch (err) {
      setLocalError(getApiErrorMessage(err, 'Не удалось загрузить права доступа'));
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    if (!open || !item) return;
    setEmail('');
    setPermissionType(getAvailablePermissionOptions(item)[0].value);
    setInherit(item.type === 'folder');
    setPublicToken(item.is_public && item.public_token ? item.public_token : '');
    setPublicExpiresAt(item.is_public && item.public_expires_at ? item.public_expires_at : '');
    setPublicDuration('1440');
    setLocalSuccess('');
    loadPermissions();
  }, [open, item, loadPermissions]);

  const grantPermission = async () => {
    setBusy(true);
    setLocalError('');
    try {
      await api.post(getResourcePath(item, '/permissions/grant/'), {
        user_email: email.trim(),
        permission_type: permissionType,
        inherit: item.type === 'folder' ? inherit : false,
      });
      setEmail('');
      setLocalSuccess('Права доступа выданы');
      await loadPermissions();
      onChanged?.();
    } catch (err) {
      setLocalError(getApiErrorMessage(err, 'Не удалось выдать права'));
    } finally {
      setBusy(false);
    }
  };

  const revokePermission = async (permission) => {
    setBusy(true);
    setLocalError('');
    try {
      await api.delete(getResourcePath(item, '/permissions/revoke/'), { data: { user_email: permission.user_email } });
      setLocalSuccess('Права доступа отозваны');
      await loadPermissions();
      onChanged?.();
    } catch (err) {
      setLocalError(getApiErrorMessage(err, 'Не удалось отозвать права'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 800 }}>
        <Security color="primary" />
        Доступ: {item?.name}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {localError && <Alert severity="error" onClose={() => setLocalError('')}>{localError}</Alert>}
        {localSuccess && <Alert severity="success" onClose={() => setLocalSuccess('')}>{localSuccess}</Alert>}
        <PublicLinkPanel item={item} publicToken={publicToken} setPublicToken={setPublicToken} publicExpiresAt={publicExpiresAt} setPublicExpiresAt={setPublicExpiresAt} duration={publicDuration} setDuration={setPublicDuration} busy={busy} setBusy={setBusy} setLocalError={setLocalError} setLocalSuccess={setLocalSuccess} onChanged={onChanged} />
        <Divider />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Выдать права</Typography>
          <GrantPermissionForm item={item} email={email} setEmail={setEmail} permissionType={permissionType} setPermissionType={setPermissionType} inherit={inherit} setInherit={setInherit} busy={busy} onSubmit={grantPermission} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Текущие права</Typography>
          {loading ? <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box> : <PermissionsList permissions={permissions} busy={busy} onRevoke={revokePermission} />}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}

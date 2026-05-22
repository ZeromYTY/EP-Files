import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Download as DownloadIcon, Edit, MoreVert, Visibility } from '@mui/icons-material';

function isEditableTextFile(file) {
  if (file?.can_write === false) return false;
  const extension = file?.name?.split('.')?.pop()?.toLowerCase();
  return file?.type === 'file' && ['txt', 'md', 'json', 'csv', 'log', 'xml', 'html', 'js', 'py'].includes(extension);
}

function RowAction({ title, children, onClick }) {
  return (
    <Tooltip title={title}>
      <IconButton size="small" onClick={(event) => { event.stopPropagation(); onClick?.(event); }}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

function RowActions({ file, onDownloadClick, onEditClick, onPreviewClick, onMenuOpen }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
      {file.type !== 'folder' && <RowAction title="Предпросмотр" onClick={() => onPreviewClick?.(file)}><Visibility fontSize="small" /></RowAction>}
      {isEditableTextFile(file) && onEditClick && <RowAction title="Редактировать" onClick={() => onEditClick(file)}><Edit fontSize="small" /></RowAction>}
      <RowAction title={file.type === 'folder' ? 'Скачать как ZIP' : 'Скачать'} onClick={() => onDownloadClick?.(file.id, file.name, file.type)}><DownloadIcon fontSize="small" /></RowAction>
      <RowAction title="Действия" onClick={(event) => onMenuOpen?.(event, file, file.type)}><MoreVert fontSize="small" /></RowAction>
    </Box>
  );
}

export default function FileRow({ file, getFileIcon, formatFileSize, formatDate, onFolderClick, ...actions }) {
  const openItem = () => {
    if (file.type === 'folder') onFolderClick?.(file.id);
    else actions.onPreviewClick?.(file);
  };
  return (
    <Box onClick={openItem} sx={{ display: 'grid', gridTemplateColumns: '56px 1fr 150px 120px 120px', alignItems: 'center', p: 2, borderBottom: '1px solid #f0f0f0', cursor: 'pointer', '&:hover': { backgroundColor: '#f8fafc' } }}>
      <Box>{getFileIcon(file, 32)}</Box>
      <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</Typography>
      <Typography variant="body2" color="text.secondary">{formatDate(file.updated_at || file.created_at || file.date || new Date().toISOString())}</Typography>
      <Typography variant="body2" color="text.secondary">{file.type === 'folder' ? formatFileSize(file.size) : formatFileSize(file.size)}</Typography>
      <RowActions file={file} {...actions} />
    </Box>
  );
}

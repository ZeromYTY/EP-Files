import { useState } from 'react';
import { Box, Grid, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import {
  Description,
  Download as DownloadIcon,
  Edit,
  Folder,
  Image,
  MoreVert,
  Movie,
  MusicNote,
  PictureAsPdf,
  TableChart,
  Visibility,
} from '@mui/icons-material';
import FileRow from './FileRow';

const fileGroups = [
  { extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'], icon: Image, color: '#059669', bg: '#ECFDF5' },
  { extensions: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mpeg', 'mpg', 'avi'], icon: Movie, color: '#EA580C', bg: '#FFF7ED' },
  { extensions: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'], icon: MusicNote, color: '#4F46E5', bg: '#eef2ff' },
  { extensions: ['pdf'], icon: PictureAsPdf, color: '#DC2626', bg: '#FEF2F2' },
  { extensions: ['xlsx', 'xls', 'csv'], icon: TableChart, color: '#16A34A', bg: '#F0FDF4' },
];

function getExtension(file) {
  return file?.name?.split('.')?.pop()?.toLowerCase() || '';
}

function isEditableTextFile(file) {
  return file?.type === 'file' && ['txt', 'md', 'json', 'csv', 'log', 'xml', 'html', 'js', 'py'].includes(getExtension(file));
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${parseFloat((bytes / (1024 ** index)).toFixed(1))} ${sizes[index]}`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function FileVisual({ file, size = 32 }) {
  if (file.type === 'folder') return <Folder sx={{ fontSize: size, color: '#FF9800' }} />;
  const group = fileGroups.find((item) => item.extensions.includes(getExtension(file)));
  const Icon = group?.icon || Description;
  const bg = group?.bg || '#EFF6FF';
  const color = group?.color || '#2563EB';
  return (
    <Box sx={{ width: size, height: size, borderRadius: size > 36 ? '8px' : '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: bg }}>
      <Icon sx={{ fontSize: Math.round(size * 0.7), color }} />
    </Box>
  );
}

function GridActionButtons({ file, onPreviewClick, onDownloadClick, onEditClick, onMenuOpen }) {
  const buttonSx = { opacity: 0, transition: 'opacity 0.2s', zIndex: 30 };
  return (
    <>
      <Tooltip title="Предпросмотр"><IconButton className="preview-btn" onClick={(event) => { event.stopPropagation(); onPreviewClick?.(file); }} sx={{ ...buttonSx, position: 'absolute', top: 8, right: 104, color: '#2196F3' }} size="small"><Visibility fontSize="small" /></IconButton></Tooltip>
      {isEditableTextFile(file) && onEditClick && <Tooltip title="Редактировать"><IconButton className="edit-btn" onClick={(event) => { event.stopPropagation(); onEditClick(file); }} sx={{ ...buttonSx, position: 'absolute', top: 8, right: 72, color: '#1976D2' }} size="small"><Edit fontSize="small" /></IconButton></Tooltip>}
      <Tooltip title="Скачать"><IconButton className="download-btn" onClick={(event) => { event.stopPropagation(); onDownloadClick?.(file.id, file.name, file.type); }} sx={{ ...buttonSx, position: 'absolute', top: 8, right: 40, color: '#2196F3' }} size="small"><DownloadIcon fontSize="small" /></IconButton></Tooltip>
      <IconButton className="grid-menu-btn" onClick={(event) => { event.stopPropagation(); onMenuOpen?.(event, file, file.type); }} sx={{ ...buttonSx, position: 'absolute', top: 8, right: 8, color: '#757575' }} size="small"><MoreVert fontSize="small" /></IconButton>
    </>
  );
}

function GridCard({ file, handlers }) {
  const isFolder = file.type === 'folder';
  const open = () => (isFolder ? handlers.onFolderClick?.(file.id) : handlers.onPreviewClick?.(file));
  return (
    <Paper elevation={0} onClick={open} sx={{ p: 2, borderRadius: '12px', border: '1px solid #e0e0e0', position: 'relative', cursor: 'pointer', '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.1)', transform: 'translateY(-2px)', borderColor: '#2196F3', '& .grid-menu-btn,.download-btn,.preview-btn,.edit-btn': { opacity: 1 } } }}>
      {isFolder ? <FolderActions folder={file} handlers={handlers} /> : <GridActionButtons file={file} {...handlers} />}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><FileVisual file={file} size={44} /></Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 6 }}>{file.name}</Typography>
      <Typography variant="caption" color="text.secondary">{formatDate(file.created_at || file.updated_at || file.date || new Date().toISOString())}{file.size && ` • ${formatFileSize(file.size)}`}</Typography>
    </Paper>
  );
}

function FolderActions({ folder, handlers }) {
  return (
    <>
      <Tooltip title="Скачать как ZIP"><IconButton className="download-btn" onClick={(event) => { event.stopPropagation(); handlers.onDownloadClick?.(folder.id, folder.name, 'folder'); }} sx={{ position: 'absolute', top: 8, right: 40, opacity: 0, color: '#2196F3', zIndex: 30 }} size="small"><DownloadIcon fontSize="small" /></IconButton></Tooltip>
      <IconButton className="grid-menu-btn" onClick={(event) => { event.stopPropagation(); handlers.onMenuOpen?.(event, folder, 'folder'); }} sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, color: '#757575', zIndex: 30 }} size="small"><MoreVert fontSize="small" /></IconButton>
    </>
  );
}

async function getDroppedFiles(event) {
  return Array.from(event.dataTransfer.files || []);
}

export default function FileList({ files, viewMode, onFileDropped, ...handlers }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const droppedFiles = await getDroppedFiles(event);
    if (droppedFiles.length > 0) onFileDropped?.(droppedFiles, null);
  };
  const wrapperSx = {
    position: 'relative', width: '100%', minHeight: '300px', borderRadius: '12px',
    boxShadow: isDragActive ? '0 0 0 3px #ffffff, 0 0 0 6px #2196F3' : 'none',
  };
  return (
    <Box onDragOver={(event) => { event.preventDefault(); setIsDragActive(true); }} onDragLeave={() => setIsDragActive(false)} onDrop={handleDrop} sx={wrapperSx}>
      {viewMode === 'grid' ? (
        <Grid container spacing={2}>{files.map((file) => <Grid item xs={12} sm={6} md={4} lg={3} key={`${file.type}-${file.id}`}><GridCard file={file} handlers={handlers} /></Grid>)}</Grid>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden', backgroundColor: '#fff' }}>
          {files.map((file) => <FileRow key={`${file.type}-${file.id}`} file={file} getFileIcon={(item, size) => <FileVisual file={item} size={size} />} formatFileSize={formatFileSize} formatDate={formatDate} onFileDropped={onFileDropped} {...handlers} />)}
        </Paper>
      )}
    </Box>
  );
}

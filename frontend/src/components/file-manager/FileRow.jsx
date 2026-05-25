import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Download as DownloadIcon, Edit, MoreVert, Star } from '@mui/icons-material';
import { getDraggedManagerItem, hasDraggedManagerItem, setDraggedManagerItem } from './dragDrop';

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

function canReportFile(file, currentUserEmail) {
  return file.type === 'file' && file.owner_email && file.owner_email !== currentUserEmail;
}

function RowActions({ file, onDownloadClick, onEditClick, onFavoriteClick, onMenuOpen }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
      {file.type !== 'folder' && <RowAction title={file.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={() => onFavoriteClick?.(file)}><Star fontSize="small" sx={{ color: file.is_favorite ? '#f59e0b' : 'inherit' }} /></RowAction>}
      {isEditableTextFile(file) && onEditClick && <RowAction title="Редактировать" onClick={() => onEditClick(file)}><Edit fontSize="small" /></RowAction>}
      <RowAction title={file.type === 'folder' ? 'Скачать как ZIP' : 'Скачать'} onClick={() => onDownloadClick?.(file.id, file.name, file.type)}><DownloadIcon fontSize="small" /></RowAction>
      <RowAction title="Действия" onClick={(event) => onMenuOpen?.(event, file, file.type)}><MoreVert fontSize="small" /></RowAction>
    </Box>
  );
}

function UploaderEmail({ file, currentUserEmail }) {
  if (file.type === 'folder') return <Typography variant="body2" color="text.secondary">-</Typography>;
  if (!canReportFile(file, currentUserEmail)) return <span />;
  const label = file.owner_email ? `Загрузил: ${file.owner_email}` : 'Загрузил: -';
  return (
    <Tooltip title={label}>
      <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Tooltip>
  );
}

export default function FileRow({ file, getFileIcon, formatFileSize, formatDate, onFolderClick, ...actions }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const isFolder = file.type === 'folder';
  const isDraggableFile = file.type === 'file' && file.can_write !== false;
  const openItem = () => {
    if (isFolder) onFolderClick?.(file.id);
    else actions.onPreviewClick?.(file);
  };
  const openContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.onMenuOpen?.(event, file, file.type);
  };
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    stop(e);
    setIsDragActive(false);
    const movedItem = getDraggedManagerItem(e);
    if (movedItem && isFolder) {
      actions.onMoveFileToFolder?.(movedItem, file);
      return;
    }
    if (movedItem) return;
    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    if (droppedFiles.length === 0) return;
    if (isFolder) actions.onFileDropped?.(droppedFiles, file.id);
    else actions.onFileDropped?.(droppedFiles);
  };
  const handleDragOver = (e) => {
    if (hasDraggedManagerItem(e) && !isFolder) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = hasDraggedManagerItem(e) ? 'move' : 'copy';
    setIsDragActive(true);
  };
  return (
    <Box draggable={isDraggableFile} onDragStart={(event) => setDraggedManagerItem(event, file)} onClick={openItem} onContextMenu={openContextMenu} onDragOver={handleDragOver} onDragLeave={() => setIsDragActive(false)} onDrop={handleDrop} sx={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) minmax(140px, 220px) 150px 120px 120px', alignItems: 'center', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'divider', cursor: isDraggableFile ? 'grab' : 'pointer', backgroundColor: isDragActive ? 'rgba(68, 215, 182, 0.08)' : 'inherit', '&:hover': { backgroundColor: (theme) => theme.ep.hover }, '&:active': { cursor: isDraggableFile ? 'grabbing' : 'pointer' } }}>
      <Box>{getFileIcon(file, 32)}</Box>
      <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</Typography>
      <UploaderEmail file={file} currentUserEmail={actions.currentUserEmail} />
      <Typography variant="body2" color="text.secondary">{formatDate(file.updated_at || file.created_at || file.date || new Date().toISOString())}</Typography>
      <Typography variant="body2" color="text.secondary">{file.type === 'folder' ? formatFileSize(file.size) : formatFileSize(file.size)}</Typography>
      <RowActions file={file} {...actions} />
    </Box>
  );
}

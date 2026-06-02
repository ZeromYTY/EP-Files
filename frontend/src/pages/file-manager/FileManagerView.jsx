import React, { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Fab,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  ArrowBack,
  ArrowDropDown,
  ArrowDropUp,
  Close,
  CloudUpload,
  Delete,
  Download as DownloadIcon,
  Edit,
  Folder as FolderIcon,
  FolderOpen,
  GridView,
  Home,
  NavigateNext,
  ReportProblem,
  RestoreFromTrash,
  Search,
  Share,
  Star,
  Upload,
  ViewList,
} from '@mui/icons-material';
import AccessControlDialog from '../../components/file-manager/AccessControlDialog';
import FileList from '../../components/file-manager/FileList';
import HeaderProfileButton from '../../components/HeaderProfileButton';
import MoveFolderDialog from '../../components/file-manager/MoveFolderDialog';
import TaskStatusItem from '../../components/TaskStatusItem';
import TextFileEditorDialog from '../../components/file-manager/TextFileEditorDialog';
import { hasDraggedSystemFiles } from '../../components/file-manager/dragDrop';

function FileManagerHeader({ user, searchQuery, setSearchQuery, navigate }) {
  const headerButtonSx = {
    minWidth: { xs: 0, sm: 150 },
    height: 40,
    whiteSpace: 'nowrap',
    px: { xs: 1.25, sm: 2 },
    fontSize: { xs: '0.78rem', sm: '0.875rem' },
    '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
  };

  return (
    <Box sx={{ backgroundColor: (theme) => theme.ep.header, backdropFilter: 'blur(18px)', borderBottom: '1px solid', borderColor: 'divider', px: { xs: 1.5, sm: 2, md: 3 }, py: 2, display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1000, gap: { xs: 1.25, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' } }}>
      <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', fontSize: '1.5rem' }}>ep-files</Typography>
      </Box>
      <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' }, maxWidth: { xs: 'none', sm: 600 }, mx: { xs: 0, sm: 2, md: 4 } }}>
        <TextField fullWidth placeholder="Поиск файлов..." size="small" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>, sx: { borderRadius: '8px' } }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, justifyContent: { xs: 'space-between', sm: 'flex-end' }, width: { xs: '100%', sm: 'auto' } }}>
        <Button variant="contained" onClick={() => navigate('/trash')} startIcon={<RestoreFromTrash />} sx={{ ...headerButtonSx, flex: { xs: 1, sm: 'initial' }, backgroundColor: 'primary.dark', '&:hover': { backgroundColor: 'primary.main' } }}>Корзина</Button>
        <HeaderProfileButton user={user} onClick={() => navigate('/files')} sx={{ ...headerButtonSx, flex: { xs: 1, sm: 'initial' } }} />
      </Box>
    </Box>
  );
}

function BreadcrumbBar({ currentFolderId, breadcrumbs, viewMode, setViewMode, onBack, onHome, onBreadcrumbClick }) {
  return (
    <Paper elevation={0} sx={{ p: { xs: 1.25, sm: 2 }, mb: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider', backgroundColor: (theme) => theme.ep.panel }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <IconButton size="small" onClick={onBack} disabled={currentFolderId === null} sx={{ color: currentFolderId === null ? 'text.disabled' : 'primary.main' }}><ArrowBack /></IconButton>
        <IconButton size="small" onClick={onHome} disabled={currentFolderId === null} sx={{ color: currentFolderId === null ? 'text.disabled' : 'primary.main' }}><Home /></IconButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, maxWidth: '100%', flexWrap: 'wrap' }}>
          <MuiLink component="button" variant="body1" onClick={() => onBreadcrumbClick(null)} sx={{ textDecoration: 'none', color: 'primary.main', cursor: 'pointer' }}>Корень</MuiLink>
          {breadcrumbs.map((folder) => <BreadcrumbItem key={folder.id} folder={folder} onClick={onBreadcrumbClick} />)}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} sx={{ color: 'primary.main' }}>{viewMode === 'list' ? <GridView /> : <ViewList />}</IconButton>
      </Box>
    </Paper>
  );
}

function BreadcrumbItem({ folder, onClick }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <NavigateNext fontSize="small" sx={{ color: 'text.secondary' }} />
      <MuiLink component="button" variant="body1" onClick={() => onClick(folder.id)} sx={{ textDecoration: 'none', color: 'primary.main', cursor: 'pointer' }}>{folder.name}</MuiLink>
    </Box>
  );
}

function ContentArea({ loading, sortedItems, locationName, listProps }) {
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', fontSize: { xs: '1.35rem', sm: '1.5rem' }, overflowWrap: 'anywhere' }}>{locationName}</Typography>
        <Typography variant="body2" color="text.secondary">{sortedItems.length} объектов</Typography>
      </Box>
      {loading ? <LoadingState /> : sortedItems.length === 0 ? <EmptyState onFileDropped={listProps?.onFileDropped} /> : <FileList files={sortedItems} {...listProps} />}
    </>
  );
}

function LoadingState() {
  return <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress /></Box>;
}

function EmptyState({ onFileDropped }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const stop = (event) => { event.preventDefault(); event.stopPropagation(); };
  const handleDrop = async (event) => {
    stop(event);
    setIsDragActive(false);
    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    if (droppedFiles.length > 0) onFileDropped?.(droppedFiles);
  };
  return (
    <Box onDragOver={(e) => { stop(e); setIsDragActive(true); }} onDragLeave={(e) => { stop(e); setIsDragActive(false); }} onDrop={handleDrop} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: { xs: 7, sm: 12 }, px: 2, textAlign: 'center', borderRadius: '12px', border: '1px dashed', borderColor: isDragActive ? 'primary.main' : 'divider', backgroundColor: isDragActive ? 'rgba(68, 215, 182, 0.08)' : 'rgba(255,255,255,0.02)', transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)', ...(isDragActive ? { boxShadow: '0 0 0 3px rgba(68, 215, 182, 0.12)', transform: 'scale(1.01)' } : {}) }}>
      <Box sx={{ width: { xs: 76, sm: 96 }, height: { xs: 76, sm: 96 }, backgroundColor: 'rgba(68, 215, 182, 0.12)', border: '1px solid rgba(68, 215, 182, 0.24)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3, mx: 'auto', animation: 'epSoftPulse 2.8s ease-in-out infinite' }}>
        <CloudUpload sx={{ fontSize: { xs: 38, sm: 48 }, color: 'primary.main', margin: 'auto' }} />
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5, fontSize: { xs: '1.55rem', sm: '2rem' } }}>Пусто</Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 320, lineHeight: 1.6 }}>Попробуйте добавить файлы, перетащив их сюда или нажав круглую кнопку справа внизу</Typography>
    </Box>
  );
}

function CreateFab({ tasks, anchorEl, onCreateClick }) {
  const isOpen = Boolean(anchorEl);
  return (
    <Box sx={{ position: 'fixed', bottom: { xs: tasks.length > 0 ? 96 : 20, sm: tasks.length > 0 ? 116 : 48 }, right: { xs: 20, sm: 48 }, zIndex: 1100, transition: 'bottom 0.3s ease' }}>
      <Tooltip title="Создать или загрузить" placement="left">
        <Fab variant="extended" onClick={onCreateClick} sx={{ background: 'linear-gradient(135deg, #44d7b6 0%, #f4b95f 100%)', color: '#06110f', px: { xs: 2.25, sm: 5 }, py: { xs: 2.25, sm: 4 }, minWidth: { xs: 56, sm: 64 }, borderRadius: '9999px', textTransform: 'none', gap: { xs: 0, sm: 1.5 }, boxShadow: '0 18px 42px rgba(68, 215, 182, 0.28)', '&:hover': { filter: 'brightness(1.08)' } }}>
          <Add sx={{ transform: isOpen ? 'rotate(135deg)' : 'rotate(0deg)', transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)', fontSize: { xs: '1.6rem', sm: '1.8rem' } }} />
          <Typography variant="button" sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 800, letterSpacing: 0, fontSize: '1.05rem' }}>Создать</Typography>
        </Fab>
      </Tooltip>
    </Box>
  );
}

function CreateMenu({ anchorEl, onClose, onCreateFolder, onUpload }) {
  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <MenuItem onClick={onCreateFolder}><FolderIcon sx={{ color: '#FF9800', mr: 1.5, fontSize: 20 }} /> Папка</MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={onUpload}><Upload sx={{ color: '#9C27B0', mr: 1.5, fontSize: 20 }} /> Загрузить файл</MenuItem>
    </Menu>
  );
}

function NameDialog({ open, title, label, value, setValue, onClose, onSubmit, submitLabel, disabled }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <TextField autoFocus margin="dense" label={label} fullWidth value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && !disabled && onSubmit()} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={onSubmit} variant="contained" disabled={disabled}>{submitLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteDialog({ open, fileToDelete, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ fontWeight: 600 }}>Удалить объект?</DialogTitle>
      <DialogContent><DialogContentText>Вы действительно хотите удалить {fileToDelete?.type === 'folder' ? 'папку' : 'файл'} "{fileToDelete?.name}"? Действие нельзя отменить.</DialogContentText></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={onConfirm} variant="contained" sx={{ backgroundColor: '#D32F2F' }}>Удалить</Button>
      </DialogActions>
    </Dialog>
  );
}

function canReportItem(item, currentUserEmail) {
  return item?.type === 'file' && item.owner_email && item.owner_email !== currentUserEmail;
}

function ReportDialog({ open, file, reason, setReason, message, setMessage, onClose, onSubmit }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Жалоба на файл</DialogTitle>
      <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DialogContentText>{file?.name}</DialogContentText>
        <TextField autoFocus label="Причина" value={reason} onChange={(event) => setReason(event.target.value)} required fullWidth />
        <TextField label="Описание" value={message} onChange={(event) => setMessage(event.target.value)} multiline minRows={4} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" color="warning" disabled={!reason.trim()} onClick={onSubmit}>Отправить</Button>
      </DialogActions>
    </Dialog>
  );
}

function ItemMenu({ anchorEl, anchorPosition, selectedItem, currentUserEmail, canEdit, onClose, actions }) {
  return (
    <Menu
      anchorEl={anchorEl}
      anchorReference={anchorPosition ? 'anchorPosition' : 'anchorEl'}
      anchorPosition={anchorPosition || undefined}
      open={Boolean(anchorEl || anchorPosition)}
      onClose={onClose}
    >
      {selectedItem && canEdit(selectedItem) && <MenuItem onClick={actions.edit}><Edit fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} /> Редактировать</MenuItem>}
      <MenuItem onClick={actions.rename}><Edit fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} /> Переименовать</MenuItem>
      <MenuItem onClick={actions.move}><FolderOpen fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />Переместить</MenuItem>
      <MenuItem onClick={actions.favorite}><Star sx={{ fontSize: 18, mr: 1.5, color: selectedItem?.is_favorite ? 'secondary.main' : 'text.secondary' }} />{selectedItem?.is_favorite ? 'Убрать из избранного' : 'В избранное'}</MenuItem>
      <MenuItem onClick={actions.download}><DownloadIcon fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />{selectedItem?.type === 'folder' ? 'Скачать как ZIP' : 'Скачать'}</MenuItem>
      {canReportItem(selectedItem, currentUserEmail) && <MenuItem onClick={actions.report}><ReportProblem fontSize="small" sx={{ mr: 1.5, color: '#ED6C02' }} />Пожаловаться</MenuItem>}
      <MenuItem onClick={actions.access}><Share fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />Доступ и ссылки</MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={actions.delete} sx={{ color: 'error.main' }}><Delete fontSize="small" sx={{ mr: 1.5, color: 'error.main' }} /> Удалить</MenuItem>
    </Menu>
  );
}

function TaskWidget({ tasks, isMinimized, setIsMinimized, clearTasks }) {
  if (tasks.length === 0) return null;
  const activeCount = tasks.filter((task) => ['uploading', 'downloading', 'deleting'].includes(task.status)).length;
  const errorCount = tasks.filter((task) => task.status === 'error').length;
  return (
    <Paper elevation={4} sx={{ position: 'fixed', bottom: { xs: 12, sm: 24 }, right: { xs: 12, sm: 24 }, left: { xs: 12, sm: 'auto' }, width: { xs: 'auto', sm: 360 }, backgroundColor: (theme) => theme.ep.panel, borderRadius: '12px', boxShadow: (theme) => theme.ep.shadow, zIndex: 2000, overflow: 'hidden', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Операции с файлами</Typography>
          <Typography variant="caption" color={errorCount ? 'error.main' : 'text.secondary'}>{errorCount ? `Ошибок: ${errorCount}` : activeCount ? `В процессе: ${activeCount}` : `Задач: ${tasks.length}`}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={() => setIsMinimized(!isMinimized)}>{isMinimized ? <ArrowDropUp /> : <ArrowDropDown />}</IconButton>
          <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={clearTasks}><Close fontSize="small" /></IconButton>
        </Box>
      </Box>
      {!isMinimized && <Box sx={{ overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 360 }}>{tasks.map((task) => <TaskStatusItem key={task.id} task={task} />)}</Box>}
    </Paper>
  );
}

function GlobalDropOverlay({ active, locationName }) {
  if (!active) return null;
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1900,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 },
        backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(5, 7, 10, 0.72)' : 'rgba(241, 245, 249, 0.74)'),
        backdropFilter: 'blur(10px)',
        animation: 'epScaleIn 140ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: 'min(520px, 100%)',
          p: { xs: 3, sm: 4 },
          borderRadius: '16px',
          border: '2px dashed',
          borderColor: 'primary.main',
          backgroundColor: (theme) => theme.ep.panel,
          boxShadow: (theme) => theme.ep.menuShadow,
          textAlign: 'center',
        }}
      >
        <Box sx={{ width: 88, height: 88, mx: 'auto', mb: 2, borderRadius: '50%', display: 'grid', placeItems: 'center', backgroundColor: 'rgba(68, 215, 182, 0.13)', border: '1px solid rgba(68, 215, 182, 0.28)', animation: 'epSoftPulse 2.2s ease-in-out infinite' }}>
          <CloudUpload sx={{ fontSize: 46, color: 'primary.main' }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 900, color: 'text.primary', mb: 1 }}>
          Отпустите файл, чтобы загрузить
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          Файл будет добавлен в папку "{locationName}"
        </Typography>
      </Paper>
    </Box>
  );
}

export default function FileManagerView(props) {
  const { user, navigate, searchQuery, setSearchQuery, viewMode, setViewMode, currentFolderId, breadcrumbs, sortedItems, loading, error, success, setError, setSuccess, locationName, handlers, dialogs, tasks, textEditor } = props;
  const [globalDropActive, setGlobalDropActive] = useState(false);
  const globalDragDepth = useRef(0);
  const resetGlobalDrop = () => {
    globalDragDepth.current = 0;
    setGlobalDropActive(false);
  };
  const handleGlobalDragEnter = (event) => {
    if (!hasDraggedSystemFiles(event)) return;
    event.preventDefault();
    globalDragDepth.current += 1;
    setGlobalDropActive(true);
  };
  const handleGlobalDragOver = (event) => {
    if (!hasDraggedSystemFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    setGlobalDropActive(true);
  };
  const handleGlobalDragLeave = (event) => {
    if (!hasDraggedSystemFiles(event)) return;
    event.preventDefault();
    globalDragDepth.current = Math.max(0, globalDragDepth.current - 1);
    if (globalDragDepth.current === 0) setGlobalDropActive(false);
  };
  const handleGlobalDrop = (event) => {
    if (!hasDraggedSystemFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    resetGlobalDrop();
    if (droppedFiles.length > 0) handlers.listProps?.onFileDropped?.(droppedFiles);
  };
  return (
    <Box className="ep-page" onDragEnter={handleGlobalDragEnter} onDragOver={handleGlobalDragOver} onDragLeave={handleGlobalDragLeave} onDrop={handleGlobalDrop} sx={{ minHeight: '100vh', background: (theme) => theme.ep.pageGradient, position: 'relative' }}>
      <input type="file" id="manual-file-input" onChange={handlers.manualUpload} style={{ display: 'none' }} />
      <FileManagerHeader user={user} searchQuery={searchQuery} setSearchQuery={setSearchQuery} navigate={navigate} />
      <Container className="ep-stagger" maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
        <BreadcrumbBar currentFolderId={currentFolderId} breadcrumbs={breadcrumbs} viewMode={viewMode} setViewMode={setViewMode} onBack={handlers.back} onHome={handlers.home} onBreadcrumbClick={handlers.breadcrumbClick} />
        <ContentArea loading={loading} sortedItems={sortedItems} locationName={locationName} listProps={handlers.listProps} />
      </Container>
      <CreateFab tasks={tasks.tasks} anchorEl={dialogs.anchorEl} onCreateClick={dialogs.openCreateMenu} />
      <CreateMenu anchorEl={dialogs.anchorEl} onClose={dialogs.closeCreateMenu} onCreateFolder={dialogs.startCreateFolder} onUpload={dialogs.startManualUpload} />
      <NameDialog open={dialogs.createFolderOpen} title="Создать папку" label="Название папки" value={dialogs.newFolderName} setValue={dialogs.setNewFolderName} onClose={dialogs.closeCreateFolder} onSubmit={dialogs.submitCreateFolder} submitLabel="Создать" disabled={!dialogs.newFolderName.trim()} />
      <NameDialog open={dialogs.renameDialogOpen} title={`Переименовать ${dialogs.selectedItem?.type === 'folder' ? 'папку' : 'файл'}`} label="Новое название" value={dialogs.newName} setValue={dialogs.setNewName} onClose={dialogs.closeRename} onSubmit={dialogs.submitRename} submitLabel="Переименовать" disabled={!dialogs.newName.trim() || dialogs.newName.trim() === dialogs.selectedItem?.name} />
      <MoveFolderDialog open={dialogs.moveDialogOpen} item={dialogs.selectedItem} currentFolderId={currentFolderId} onClose={dialogs.closeMove} onMoved={dialogs.onMoved} />
      <TextFileEditorDialog
        open={textEditor.textEditorOpen}
        file={textEditor.textEditorFile}
        content={textEditor.textEditorContent}
        loading={textEditor.textEditorLoading}
        saving={textEditor.textEditorSaving}
        error={textEditor.textEditorError}
        onChange={textEditor.setTextEditorContent}
        onCancel={textEditor.closeTextEditor}
        onSave={textEditor.handleTextEditorSave}
      />
      <DeleteDialog open={dialogs.deleteDialogOpen} fileToDelete={dialogs.fileToDelete} onClose={dialogs.closeDelete} onConfirm={dialogs.confirmDelete} />
      <ReportDialog open={dialogs.reportDialogOpen} file={dialogs.reportFile} reason={dialogs.reportReason} setReason={dialogs.setReportReason} message={dialogs.reportMessage} setMessage={dialogs.setReportMessage} onClose={dialogs.closeReport} onSubmit={dialogs.submitReport} />
      <AccessControlDialog open={dialogs.accessDialogOpen} item={dialogs.selectedItem} onClose={dialogs.closeAccess} onChanged={dialogs.onAccessChanged} />
      <ItemMenu anchorEl={dialogs.menuAnchor} anchorPosition={dialogs.menuAnchorPosition} selectedItem={dialogs.selectedItem} currentUserEmail={user?.email} canEdit={handlers.canEdit} onClose={dialogs.closeItemMenu} actions={dialogs.itemMenuActions} />
      <TaskWidget tasks={tasks.tasks} isMinimized={tasks.isWidgetMinimized} setIsMinimized={tasks.setIsWidgetMinimized} clearTasks={() => tasks.setTasks([])} />
      <GlobalDropOverlay active={globalDropActive} locationName={locationName} />
    </Box>
  );
}

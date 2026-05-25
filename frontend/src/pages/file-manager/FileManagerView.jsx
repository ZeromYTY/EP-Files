import React, { useState } from 'react';
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
  CheckCircle,
  Close,
  CloudUpload,
  Delete,
  Download as DownloadIcon,
  Edit,
  Folder as FolderIcon,
  FolderOpen,
  GridView,
  Home,
  Logout,
  NavigateNext,
  Person,
  ReportProblem,
  Search,
  Share,
  Star,
  Upload,
  ViewList,
} from '@mui/icons-material';
import AccessControlDialog from '../../components/file-manager/AccessControlDialog';
import FileList from '../../components/file-manager/FileList';
import MoveFolderDialog from '../../components/file-manager/MoveFolderDialog';
import TextFileEditorDialog from '../../components/file-manager/TextFileEditorDialog';

function FileManagerHeader({ user, searchQuery, setSearchQuery, navigate, onLogout }) {
  return (
    <Box sx={{ backgroundColor: (theme) => theme.ep.header, backdropFilter: 'blur(18px)', borderBottom: '1px solid', borderColor: 'divider', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1000 }}>
      <Box component="a" href="/" sx={{ display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', fontSize: '1.5rem' }}>ep-files</Typography>
      </Box>
      <Box sx={{ flex: 1, maxWidth: 600, mx: 4 }}>
        <TextField fullWidth placeholder="Поиск файлов..." size="small" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>, sx: { borderRadius: '8px' } }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title={user?.email || 'Пользователь'}><IconButton onClick={() => navigate('/files')} sx={{ backgroundColor: 'primary.main', color: 'primary.contrastText', '&:hover': { backgroundColor: 'primary.light' } }}><Person /></IconButton></Tooltip>
        <Button variant="outlined" size="small" color="error" onClick={onLogout} startIcon={<Logout />}>Выйти</Button>
      </Box>
    </Box>
  );
}

function BreadcrumbBar({ currentFolderId, breadcrumbs, viewMode, setViewMode, onBack, onHome, onBreadcrumbClick }) {
  return (
    <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider', backgroundColor: (theme) => theme.ep.panel }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <IconButton size="small" onClick={onBack} disabled={currentFolderId === null} sx={{ color: currentFolderId === null ? 'text.disabled' : 'primary.main' }}><ArrowBack /></IconButton>
        <IconButton size="small" onClick={onHome} disabled={currentFolderId === null} sx={{ color: currentFolderId === null ? 'text.disabled' : 'primary.main' }}><Home /></IconButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>{locationName}</Typography>
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
    <Box onDragOver={(e) => { stop(e); setIsDragActive(true); }} onDragLeave={(e) => { stop(e); setIsDragActive(false); }} onDrop={handleDrop} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyY: 'center', py: 12, textAlign: 'center', borderRadius: '12px', border: '1px dashed', borderColor: isDragActive ? 'primary.main' : 'divider', backgroundColor: isDragActive ? 'rgba(68, 215, 182, 0.08)' : 'rgba(255,255,255,0.02)', ...(isDragActive ? { boxShadow: '0 0 0 3px rgba(68, 215, 182, 0.12)' } : {}) }}>
      <Box sx={{ width: 96, height: 96, backgroundColor: 'rgba(68, 215, 182, 0.12)', border: '1px solid rgba(68, 215, 182, 0.24)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyX: 'center', mb: 3, mx: 'auto' }}>
        <CloudUpload sx={{ fontSize: 48, color: 'primary.main', margin: 'auto' }} />
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5, fontSize: '2rem' }}>Пусто</Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 320, lineHeight: 1.6 }}>Попробуйте добавить файлы, перетащив их сюда или нажав круглую кнопку справа внизу</Typography>
    </Box>
  );
}

function CreateFab({ tasks, anchorEl, onCreateClick }) {
  const isOpen = Boolean(anchorEl);
  return (
    <Box sx={{ position: 'fixed', bottom: tasks.length > 0 ? 116 : 48, right: 48, zIndex: 1100, transition: 'bottom 0.3s ease' }}>
      <Tooltip title="Создать или загрузить" placement="left">
        <Fab variant="extended" onClick={onCreateClick} sx={{ background: 'linear-gradient(135deg, #44d7b6 0%, #f4b95f 100%)', color: '#06110f', px: 5, py: 4, borderRadius: '9999px', textTransform: 'none', gap: 1.5, boxShadow: '0 18px 42px rgba(68, 215, 182, 0.28)', '&:hover': { filter: 'brightness(1.08)' } }}>
          <Add sx={{ transform: isOpen ? 'rotate(135deg)' : 'rotate(0deg)', transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)', fontSize: '1.8rem' }} />
          <Typography variant="button" sx={{ fontWeight: 800, letterSpacing: '0.5px', fontSize: '1.05rem' }}>Создать</Typography>
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
  return (
    <Paper elevation={4} sx={{ position: 'fixed', bottom: 24, right: 24, width: 360, backgroundColor: (theme) => theme.ep.panel, borderRadius: '12px', boxShadow: (theme) => theme.ep.shadow, zIndex: 2000, overflow: 'hidden', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Выполняется операций: {activeCount}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={() => setIsMinimized(!isMinimized)}>{isMinimized ? <ArrowDropUp /> : <ArrowDropDown />}</IconButton>
          <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={clearTasks}><Close fontSize="small" /></IconButton>
        </Box>
      </Box>
      {!isMinimized && <Box sx={{ overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300 }}>{tasks.map((task) => <TaskItem key={task.id} task={task} />)}</Box>}
    </Paper>
  );
}

function TaskItem({ task }) {
  const isActive = ['uploading', 'downloading', 'deleting'].includes(task.status);
  return (
    <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: '8px', border: '1px solid', borderColor: 'divider', backgroundColor: task.status === 'success' ? 'rgba(74, 222, 128, 0.1)' : task.status === 'error' ? 'rgba(255, 107, 122, 0.1)' : 'rgba(255,255,255,0.035)' }}>
      {isActive ? <CircularProgress variant={task.status === 'uploading' ? 'determinate' : 'indeterminate'} value={task.status === 'uploading' ? task.progress : undefined} size={32} thickness={4.5} sx={{ color: 'primary.main' }} /> : task.status === 'success' ? <CheckCircle sx={{ color: 'success.main', fontSize: 32, flexShrink: 0 }} /> : <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'error.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</Box>}
      <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.name}</Typography>
        <Typography variant="caption" sx={{ color: task.status === 'success' ? 'success.main' : task.status === 'error' ? 'error.main' : 'text.secondary', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.subText}</Typography>
      </Box>
    </Box>
  );
}

export default function FileManagerView(props) {
  const { user, navigate, searchQuery, setSearchQuery, viewMode, setViewMode, currentFolderId, breadcrumbs, sortedItems, loading, error, success, setError, setSuccess, locationName, handlers, dialogs, tasks, textEditor } = props;
  return (
    <Box sx={{ minHeight: '100vh', background: (theme) => theme.ep.pageGradient, position: 'relative' }}>
      <input type="file" id="manual-file-input" onChange={handlers.manualUpload} style={{ display: 'none' }} />
      <FileManagerHeader user={user} searchQuery={searchQuery} setSearchQuery={setSearchQuery} navigate={navigate} onLogout={handlers.logout} />
      <Container maxWidth="lg" sx={{ py: 4 }}>
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
    </Box>
  );
}

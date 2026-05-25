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
    <Box sx={{ backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1000 }}>
      <Box component="a" href="/" sx={{ display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#2196F3', fontSize: '1.5rem' }}>ep-files</Typography>
      </Box>
      <Box sx={{ flex: 1, maxWidth: 600, mx: 4 }}>
        <TextField fullWidth placeholder="Поиск файлов..." size="small" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#9e9e9e' }} /></InputAdornment>, sx: { backgroundColor: '#f1f3f4', borderRadius: '8px', '& fieldset': { border: 'none' } } }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title={user?.email || 'Пользователь'}><IconButton onClick={() => navigate('/files')} sx={{ backgroundColor: '#2196F3', color: '#fff' }}><Person /></IconButton></Tooltip>
        <Button variant="outlined" size="small" onClick={onLogout} startIcon={<Logout />} sx={{ color: '#d32f2f', borderColor: '#d32f2f' }}>Выйти</Button>
      </Box>
    </Box>
  );
}

function BreadcrumbBar({ currentFolderId, breadcrumbs, viewMode, setViewMode, onBack, onHome, onBreadcrumbClick }) {
  return (
    <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: '12px', border: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <IconButton size="small" onClick={onBack} disabled={currentFolderId === null} sx={{ color: currentFolderId === null ? '#bdbdbd' : '#2196F3' }}><ArrowBack /></IconButton>
        <IconButton size="small" onClick={onHome} disabled={currentFolderId === null} sx={{ color: currentFolderId === null ? '#bdbdbd' : '#2196F3' }}><Home /></IconButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <MuiLink component="button" variant="body1" onClick={() => onBreadcrumbClick(null)} sx={{ textDecoration: 'none', color: '#2196F3', cursor: 'pointer' }}>Корень</MuiLink>
          {breadcrumbs.map((folder) => <BreadcrumbItem key={folder.id} folder={folder} onClick={onBreadcrumbClick} />)}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} sx={{ color: '#2196F3' }}>{viewMode === 'list' ? <GridView /> : <ViewList />}</IconButton>
      </Box>
    </Paper>
  );
}

function BreadcrumbItem({ folder, onClick }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <NavigateNext fontSize="small" sx={{ color: '#9e9e9e' }} />
      <MuiLink component="button" variant="body1" onClick={() => onClick(folder.id)} sx={{ textDecoration: 'none', color: '#2196F3', cursor: 'pointer' }}>{folder.name}</MuiLink>
    </Box>
  );
}

function ContentArea({ loading, sortedItems, locationName, listProps }) {
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#202124' }}>{locationName}</Typography>
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
    <Box onDragOver={(e) => { stop(e); setIsDragActive(true); }} onDragLeave={(e) => { stop(e); setIsDragActive(false); }} onDrop={handleDrop} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyY: 'center', py: 12, textAlign: 'center', borderRadius: '12px', ...(isDragActive ? { boxShadow: '0 0 0 3px #ffffff, 0 0 0 6px #2196F3' } : {}) }}>
      <Box sx={{ width: 96, height: 96, backgroundColor: '#e8f0fe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyX: 'center', mb: 3, mx: 'auto' }}>
        <CloudUpload sx={{ fontSize: 48, color: '#a0aec0', margin: 'auto' }} />
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 1.5, fontSize: '2rem' }}>Пусто</Typography>
      <Typography variant="body1" sx={{ color: '#64748b', maxWidth: 320, lineHeight: 1.6 }}>Попробуйте добавить файлы, перетащив их сюда или нажав круглую кнопку справа внизу</Typography>
    </Box>
  );
}

function CreateFab({ tasks, anchorEl, onCreateClick }) {
  const isOpen = Boolean(anchorEl);
  return (
    <Box sx={{ position: 'fixed', bottom: tasks.length > 0 ? 116 : 48, right: 48, zIndex: 1100, transition: 'bottom 0.3s ease' }}>
      <Tooltip title="Создать или загрузить" placement="left">
        <Fab variant="extended" onClick={onCreateClick} sx={{ backgroundColor: '#2196F3', color: '#fff', px: 5, py: 4, borderRadius: '9999px', textTransform: 'none', gap: 1.5, boxShadow: '0 8px 24px rgba(33, 150, 243, 0.35)', '&:hover': { backgroundColor: '#1976D2' } }}>
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

function ItemMenu({ anchorEl, selectedItem, currentUserEmail, canEdit, onClose, actions }) {
  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      {selectedItem && canEdit(selectedItem) && <MenuItem onClick={actions.edit}><Edit fontSize="small" sx={{ mr: 1.5, color: '#616161' }} /> Редактировать</MenuItem>}
      <MenuItem onClick={actions.rename}><Edit fontSize="small" sx={{ mr: 1.5, color: '#616161' }} /> Переименовать</MenuItem>
      <MenuItem onClick={actions.move}><FolderOpen fontSize="small" sx={{ mr: 1.5, color: '#616161' }} />Переместить</MenuItem>
      <MenuItem onClick={actions.favorite}><Star sx={{ fontSize: 18, mr: 1.5, color: selectedItem?.is_favorite ? '#f59e0b' : '#616161' }} />{selectedItem?.is_favorite ? 'Убрать из избранного' : 'В избранное'}</MenuItem>
      <MenuItem onClick={actions.download}><DownloadIcon fontSize="small" sx={{ mr: 1.5, color: '#616161' }} />{selectedItem?.type === 'folder' ? 'Скачать как ZIP' : 'Скачать'}</MenuItem>
      {canReportItem(selectedItem, currentUserEmail) && <MenuItem onClick={actions.report}><ReportProblem fontSize="small" sx={{ mr: 1.5, color: '#ED6C02' }} />Пожаловаться</MenuItem>}
      <MenuItem onClick={actions.access}><Share fontSize="small" sx={{ mr: 1.5, color: '#616161' }} />Доступ и ссылки</MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={actions.delete} sx={{ color: 'error.main' }}><Delete fontSize="small" sx={{ mr: 1.5, color: '#D32F2F' }} /> Удалить</MenuItem>
    </Menu>
  );
}

function TaskWidget({ tasks, isMinimized, setIsMinimized, clearTasks }) {
  if (tasks.length === 0) return null;
  const activeCount = tasks.filter((task) => ['uploading', 'downloading', 'deleting'].includes(task.status)).length;
  return (
    <Paper elevation={4} sx={{ position: 'fixed', bottom: 24, right: 24, width: 360, backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,0.16)', zIndex: 2000, overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Выполняется операций: {activeCount}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" sx={{ color: '#64748b' }} onClick={() => setIsMinimized(!isMinimized)}>{isMinimized ? <ArrowDropUp /> : <ArrowDropDown />}</IconButton>
          <IconButton size="small" sx={{ color: '#64748b' }} onClick={clearTasks}><Close fontSize="small" /></IconButton>
        </Box>
      </Box>
      {!isMinimized && <Box sx={{ overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300 }}>{tasks.map((task) => <TaskItem key={task.id} task={task} />)}</Box>}
    </Paper>
  );
}

function TaskItem({ task }) {
  const isActive = ['uploading', 'downloading', 'deleting'].includes(task.status);
  return (
    <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: '8px', border: '1px solid #f1f5f9', backgroundColor: task.status === 'success' ? '#f0fdf4' : task.status === 'error' ? '#fef2f2' : '#ffffff' }}>
      {isActive ? <CircularProgress variant={task.status === 'uploading' ? 'determinate' : 'indeterminate'} value={task.status === 'uploading' ? task.progress : undefined} size={32} thickness={4.5} sx={{ color: '#2196F3' }} /> : task.status === 'success' ? <CheckCircle sx={{ color: '#16a34a', fontSize: 32, flexShrink: 0 }} /> : <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</Box>}
      <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.name}</Typography>
        <Typography variant="caption" sx={{ color: task.status === 'success' ? '#16a34a' : task.status === 'error' ? '#ef4444' : '#64748b', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.subText}</Typography>
      </Box>
    </Box>
  );
}

export default function FileManagerView(props) {
  const { user, navigate, searchQuery, setSearchQuery, viewMode, setViewMode, currentFolderId, breadcrumbs, sortedItems, loading, error, success, setError, setSuccess, locationName, handlers, dialogs, tasks, textEditor } = props;
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8f9fa', position: 'relative' }}>
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
      <ItemMenu anchorEl={dialogs.menuAnchor} selectedItem={dialogs.selectedItem} currentUserEmail={user?.email} canEdit={handlers.canEdit} onClose={dialogs.closeItemMenu} actions={dialogs.itemMenuActions} />
      <TaskWidget tasks={tasks.tasks} isMinimized={tasks.isWidgetMinimized} setIsMinimized={tasks.setIsWidgetMinimized} clearTasks={() => tasks.setTasks([])} />
    </Box>
  );
}

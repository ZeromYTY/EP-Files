import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import { createFolder, moveFileToFolder, renameSelectedItem, toggleFavoriteItem, useDownloadCommand, useSelectionDialogs, useUploadCommand } from './file-manager/useFileManagerCommands';
import { currentLocationName, isEditableTextFile, sortedFileManagerItems } from './file-manager/fileManagerHelpers';
import FileManagerView from './file-manager/FileManagerView';
import useFileManagerData from './file-manager/useFileManagerData';
import useTaskQueue from './file-manager/useTaskQueue';
import useTextEditor from './file-manager/useTextEditor';
import api from '../api/axios';

function buildListProps({ viewMode, setCurrentFolderId, download, onPreviewFile, textEditor, dialogs, processUpload, moveFile, user }) {
  return {
    viewMode,
    currentUserEmail: user?.email,
    onFolderClick: setCurrentFolderId,
    onDownloadClick: download,
    onPreviewClick: onPreviewFile,
    onFavoriteClick: dialogs.itemMenuActions.favoriteItem,
    onDeleteClick: dialogs.startDelete,
    onEditClick: textEditor.openTextFileEditor,
    onMenuOpen: dialogs.openItemMenu,
    onReportClick: dialogs.openReport,
    onFileDropped: processUpload,
    onMoveFileToFolder: moveFile,
  };
}

function buildHandlers({ user, navigate, logout, state, data, commands, dialogs, textEditor, onPreviewFile }) {
  const back = () => {
    const current = data.breadcrumbs.find((folder) => folder.id === state.currentFolderId);
    state.setCurrentFolderId(current?.parent_id || null);
  };
  return {
    logout: () => { logout(); navigate('/login'); },
    manualUpload: (event) => commands.manualUpload(event),
    back,
    home: () => state.setCurrentFolderId(null),
    breadcrumbClick: state.setCurrentFolderId,
    canEdit: isEditableTextFile,
    listProps: buildListProps({ viewMode: state.viewMode, setCurrentFolderId: state.setCurrentFolderId, download: commands.download, onPreviewFile, textEditor, dialogs, processUpload: commands.processUpload, moveFile: commands.moveFile, user }),
    user,
  };
}

function buildDialogs({ state, data, commands, selection, textEditor, report }) {
  const closeCreateFolder = () => state.setCreateFolderOpen(false);
  const closeItemMenu = () => { state.setMenuAnchor(null); state.setMenuAnchorPosition(null); };
  const closeRename = () => { selection.setRenameDialogOpen(false); selection.setNewName(''); };
  return {
    anchorEl: state.anchorEl,
    openCreateMenu: (event) => state.setAnchorEl(event.currentTarget),
    closeCreateMenu: () => state.setAnchorEl(null),
    startCreateFolder: () => { state.setAnchorEl(null); state.setCreateFolderOpen(true); },
    startManualUpload: () => { state.setAnchorEl(null); document.getElementById('manual-file-input')?.click(); },
    createFolderOpen: state.createFolderOpen,
    newFolderName: state.newFolderName,
    setNewFolderName: state.setNewFolderName,
    closeCreateFolder,
    submitCreateFolder: () => commands.createFolder(),
    renameDialogOpen: selection.renameDialogOpen,
    newName: selection.newName,
    setNewName: selection.setNewName,
    closeRename,
    submitRename: () => commands.rename(),
    reportDialogOpen: report.reportDialogOpen,
    reportFile: report.reportFile,
    reportReason: report.reportReason,
    setReportReason: report.setReportReason,
    reportMessage: report.reportMessage,
    setReportMessage: report.setReportMessage,
    openReport: report.openReport,
    closeReport: report.closeReport,
    submitReport: report.submitReport,
    ...buildItemDialogs({ state, data, commands, selection, textEditor, closeItemMenu, report }),
  };
}

function buildItemDialogs({ state, data, commands, selection, textEditor, closeItemMenu, report }) {
  return {
    menuAnchor: state.menuAnchor,
    menuAnchorPosition: state.menuAnchorPosition,
    selectedItem: selection.selectedItem,
    openItemMenu: (event, item, type) => {
      event.preventDefault();
      event.stopPropagation();
      selection.setSelectedItem({ ...item, type });
      if (event.type === 'contextmenu') {
        state.setMenuAnchor(null);
        state.setMenuAnchorPosition({ top: event.clientY, left: event.clientX });
      } else {
        state.setMenuAnchorPosition(null);
        state.setMenuAnchor(event.currentTarget);
      }
    },
    closeItemMenu,
    moveDialogOpen: selection.moveDialogOpen,
    closeMove: () => selection.setMoveDialogOpen(false),
    onMoved: (movedItem) => { data.setSuccess(movedItem?.type === 'folder' ? 'Папка перемещена' : 'Файл перемещён'); selection.setSelectedItem(null); data.loadData(); },
    accessDialogOpen: selection.accessDialogOpen,
    closeAccess: () => selection.setAccessDialogOpen(false),
    onAccessChanged: () => data.loadData(),
    fileToDelete: selection.fileToDelete,
    deleteDialogOpen: selection.deleteDialogOpen,
    closeDelete: () => selection.setDeleteDialogOpen(false),
    confirmDelete: selection.confirmDelete,
    itemMenuActions: buildItemMenuActions({ commands, selection, textEditor, closeItemMenu, report }),
  };
}

function buildItemMenuActions({ commands, selection, textEditor, closeItemMenu, report }) {
  return {
    edit: () => { closeItemMenu(); textEditor.openTextFileEditor(selection.selectedItem); },
    rename: () => { selection.setNewName(selection.selectedItem.name || ''); selection.setRenameDialogOpen(true); closeItemMenu(); },
    move: () => { selection.setMoveDialogOpen(true); closeItemMenu(); },
    favorite: () => { commands.favorite(selection.selectedItem); closeItemMenu(); },
    favoriteItem: (item) => commands.favorite(item),
    download: () => { commands.download(selection.selectedItem.id, selection.selectedItem.name, selection.selectedItem.type); closeItemMenu(); },
    report: () => { report.openReport(selection.selectedItem); closeItemMenu(); },
    access: () => { selection.setAccessDialogOpen(true); closeItemMenu(); },
    delete: () => { selection.setFileToDelete(selection.selectedItem); selection.setDeleteDialogOpen(true); closeItemMenu(); },
  };
}

export default function FileManager({ onPreviewFile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuAnchorPosition, setMenuAnchorPosition] = useState(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportFile, setReportFile] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const data = useFileManagerData(currentFolderId, searchQuery);
  const taskQueue = useTaskQueue();
  const processUpload = useUploadCommand({ currentFolderId, loadData: data.loadData, taskQueue });
  const download = useDownloadCommand(taskQueue);
  const textEditor = useTextEditor({ setError: data.setError, setSuccess: data.setSuccess, loadData: data.loadData });
  const selection = useSelectionDialogs({ loadData: data.loadData, setError: data.setError, setSuccess: data.setSuccess, taskQueue });
  const state = { currentFolderId, setCurrentFolderId, viewMode, setViewMode, anchorEl, setAnchorEl, menuAnchor, setMenuAnchor, menuAnchorPosition, setMenuAnchorPosition, createFolderOpen, setCreateFolderOpen, newFolderName, setNewFolderName };
  const commands = {
    processUpload,
    download,
    manualUpload: (event) => { processUpload(event.target.files?.[0], currentFolderId); event.target.value = ''; },
    createFolder: () => createFolder({ name: newFolderName, currentFolderId, setName: setNewFolderName, setOpen: setCreateFolderOpen, setError: data.setError, loadData: data.loadData }),
    rename: () => renameSelectedItem({ selectedItem: selection.selectedItem, newName: selection.newName, setRenameDialogOpen: selection.setRenameDialogOpen, setNewName: selection.setNewName, setError: data.setError, loadData: data.loadData }),
    favorite: (selectedItem) => toggleFavoriteItem({ selectedItem, setFavoriteIds: data.setFavoriteIds, setError: data.setError, setSuccess: data.setSuccess }),
    moveFile: (file, targetFolder) => moveFileToFolder({ file, targetFolder, setError: data.setError, setSuccess: data.setSuccess, loadData: data.loadData }),
  };
  const report = {
    reportDialogOpen,
    reportFile,
    reportReason,
    setReportReason,
    reportMessage,
    setReportMessage,
    openReport: (file) => { setReportFile(file); setReportDialogOpen(true); setReportReason(''); setReportMessage(''); },
    closeReport: () => { setReportDialogOpen(false); setReportFile(null); setReportReason(''); setReportMessage(''); },
    submitReport: async () => {
      if (!reportFile || !reportReason.trim()) return;
      try {
        await api.post(`/files/${reportFile.id}/report/`, { reason: reportReason.trim(), message: reportMessage.trim() });
        data.setSuccess('Жалоба отправлена администратору');
        setReportDialogOpen(false);
        setReportFile(null);
        setReportReason('');
        setReportMessage('');
      } catch (err) {
        data.setError(err.response?.data?.error || 'Не удалось отправить жалобу');
      }
    },
  };
  const dialogs = buildDialogs({ state, data, commands, selection, textEditor, report });
  const handlers = buildHandlers({ user, navigate, logout, state, data, commands, dialogs, textEditor, onPreviewFile });
  const sortedItems = sortedFileManagerItems(data.folders, data.files, data.favoriteIds);
  const locationName = currentLocationName(currentFolderId, data.breadcrumbs);
  return <FileManagerView user={user} navigate={navigate} searchQuery={searchQuery} setSearchQuery={setSearchQuery} viewMode={viewMode} setViewMode={setViewMode} currentFolderId={currentFolderId} breadcrumbs={data.breadcrumbs} sortedItems={sortedItems} loading={data.loading} error={data.error} success={data.success} setError={data.setError} setSuccess={data.setSuccess} locationName={locationName} handlers={handlers} dialogs={dialogs} tasks={taskQueue} textEditor={textEditor} />;
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import { createFolder, renameSelectedItem, toggleFavoriteItem, useDownloadCommand, useSelectionDialogs, useUploadCommand } from './file-manager/useFileManagerCommands';
import { currentLocationName, isEditableTextFile, sortedFileManagerItems } from './file-manager/fileManagerHelpers';
import FileManagerView from './file-manager/FileManagerView';
import useFileManagerData from './file-manager/useFileManagerData';
import useTaskQueue from './file-manager/useTaskQueue';
import useTextEditor from './file-manager/useTextEditor';

function buildListProps({ viewMode, setCurrentFolderId, download, onPreviewFile, textEditor, dialogs, processUpload }) {
  return {
    viewMode,
    onFolderClick: setCurrentFolderId,
    onDownloadClick: download,
    onPreviewClick: onPreviewFile,
    onFavoriteClick: dialogs.itemMenuActions.favoriteItem,
    onDeleteClick: dialogs.startDelete,
    onEditClick: textEditor.openTextFileEditor,
    onMenuOpen: dialogs.openItemMenu,
    onFileDropped: processUpload,
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
    listProps: buildListProps({ viewMode: state.viewMode, setCurrentFolderId: state.setCurrentFolderId, download: commands.download, onPreviewFile, textEditor, dialogs, processUpload: commands.processUpload }),
    user,
  };
}

function buildDialogs({ state, data, commands, selection, textEditor }) {
  const closeCreateFolder = () => state.setCreateFolderOpen(false);
  const closeItemMenu = () => state.setMenuAnchor(null);
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
    ...buildItemDialogs({ state, data, commands, selection, textEditor, closeItemMenu }),
  };
}

function buildItemDialogs({ state, data, commands, selection, textEditor, closeItemMenu }) {
  return {
    menuAnchor: state.menuAnchor,
    selectedItem: selection.selectedItem,
    openItemMenu: (event, item, type) => { event.stopPropagation(); state.setMenuAnchor(event.currentTarget); selection.setSelectedItem({ ...item, type }); },
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
    itemMenuActions: buildItemMenuActions({ commands, selection, textEditor, closeItemMenu }),
  };
}

function buildItemMenuActions({ commands, selection, textEditor, closeItemMenu }) {
  return {
    edit: () => { closeItemMenu(); textEditor.openTextFileEditor(selection.selectedItem); },
    rename: () => { selection.setNewName(selection.selectedItem.name || ''); selection.setRenameDialogOpen(true); closeItemMenu(); },
    move: () => { selection.setMoveDialogOpen(true); closeItemMenu(); },
    favorite: () => { commands.favorite(selection.selectedItem); closeItemMenu(); },
    favoriteItem: (item) => commands.favorite(item),
    download: () => { commands.download(selection.selectedItem.id, selection.selectedItem.name, selection.selectedItem.type); closeItemMenu(); },
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
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const data = useFileManagerData(currentFolderId, searchQuery);
  const taskQueue = useTaskQueue();
  const processUpload = useUploadCommand({ currentFolderId, loadData: data.loadData, taskQueue });
  const download = useDownloadCommand(taskQueue);
  const textEditor = useTextEditor({ setError: data.setError, setSuccess: data.setSuccess, loadData: data.loadData });
  const selection = useSelectionDialogs({ loadData: data.loadData, setError: data.setError, setSuccess: data.setSuccess, taskQueue });
  const state = { currentFolderId, setCurrentFolderId, viewMode, setViewMode, anchorEl, setAnchorEl, menuAnchor, setMenuAnchor, createFolderOpen, setCreateFolderOpen, newFolderName, setNewFolderName };
  const commands = {
    processUpload,
    download,
    manualUpload: (event) => { processUpload(event.target.files?.[0], currentFolderId); event.target.value = ''; },
    createFolder: () => createFolder({ name: newFolderName, currentFolderId, setName: setNewFolderName, setOpen: setCreateFolderOpen, setError: data.setError, loadData: data.loadData }),
    rename: () => renameSelectedItem({ selectedItem: selection.selectedItem, newName: selection.newName, setRenameDialogOpen: selection.setRenameDialogOpen, setNewName: selection.setNewName, setError: data.setError, loadData: data.loadData }),
    favorite: (selectedItem) => toggleFavoriteItem({ selectedItem, setFavoriteIds: data.setFavoriteIds, setError: data.setError, setSuccess: data.setSuccess }),
  };
  const dialogs = buildDialogs({ state, data, commands, selection, textEditor });
  const handlers = buildHandlers({ user, navigate, logout, state, data, commands, dialogs, textEditor, onPreviewFile });
  const sortedItems = sortedFileManagerItems(data.folders, data.files, data.favoriteIds);
  const locationName = currentLocationName(currentFolderId, data.breadcrumbs);
  return <FileManagerView user={user} navigate={navigate} searchQuery={searchQuery} setSearchQuery={setSearchQuery} viewMode={viewMode} setViewMode={setViewMode} currentFolderId={currentFolderId} breadcrumbs={data.breadcrumbs} sortedItems={sortedItems} loading={data.loading} error={data.error} success={data.success} setError={data.setError} setSuccess={data.setSuccess} locationName={locationName} handlers={handlers} dialogs={dialogs} tasks={taskQueue} textEditor={textEditor} />;
}

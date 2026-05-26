export function getApiErrorMessage(err, fallbackMessage = 'Произошла ошибка') {
  if (err.code === 'ECONNABORTED') return 'Сервер не ответил вовремя. Проверьте соединение и попробуйте снова.';
  if (!err.response) return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.';
  const serverMessage = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message;
  if (!serverMessage) return fallbackMessage;
  const translations = {
    'Access denied': 'Нет прав для выполнения операции',
    'Folder not found': 'Папка не найдена',
    'File not found': 'Файл не найден',
    'Target folder not found': 'Папка назначения не найдена',
    'Cannot move folder into its own subtree': 'Нельзя переместить папку внутрь самой себя',
    'New name is required': 'Введите новое название',
    'Folder name is required': 'Введите название папки',
    'Upload failed': 'Не удалось загрузить файл',
    'Download failed': 'Не удалось скачать файл',
  };
  return translations[serverMessage] || serverMessage;
}

export function buildFolderSizes(allFolders, allFiles) {
  const filesByFolder = {};
  allFiles.forEach((file) => {
    const folderId = file.folder;
    if (!filesByFolder[folderId]) filesByFolder[folderId] = [];
    filesByFolder[folderId].push(file);
  });
  const calculateFolderSize = (folderId) => {
    const directSize = (filesByFolder[folderId] || []).reduce((sum, file) => sum + (Number(file.size) || 0), 0);
    const subFolders = allFolders.filter((folder) => folder.parent_id === folderId);
    return directSize + subFolders.reduce((sum, folder) => sum + calculateFolderSize(folder.id), 0);
  };
  return calculateFolderSize;
}

export function buildBreadcrumbs(allFolders, currentFolderId) {
  const path = [];
  let folderId = currentFolderId;
  while (folderId) {
    const folder = allFolders.find((item) => item.id === folderId);
    if (!folder) break;
    path.unshift(folder);
    folderId = folder.parent_id;
  }
  return path;
}

export function extractIncomingFiles(incomingData) {
  if (!incomingData) return [];
  if (incomingData instanceof File) return [incomingData];
  if (incomingData instanceof FileList) return Array.from(incomingData);
  if (Array.isArray(incomingData)) return incomingData;
  if (incomingData.target?.files) return Array.from(incomingData.target.files);
  if (incomingData.files) return Array.from(incomingData.files);
  return [];
}

export function isEditableTextFile(file) {
  if (!file?.name || file.type !== 'file') return false;
  if (file.can_write === false) return false;
  const extension = file.name.split('.').pop().toLowerCase();
  return ['txt', 'md', 'json', 'csv', 'log', 'xml', 'html', 'js', 'py'].includes(extension);
}

export function sortedFileManagerItems(folders, files, favoriteIds) {
  return [
    ...folders.map((folder) => ({ ...folder, type: 'folder', is_favorite: favoriteIds.folders.includes(folder.id) })),
    ...files.map((file) => ({ ...file, type: 'file', is_favorite: favoriteIds.files.includes(file.id) })),
  ].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });
}

export function currentLocationName(currentFolderId, breadcrumbs) {
  if (!currentFolderId) return 'Главная';
  return breadcrumbs.find((folder) => folder.id === currentFolderId)?.name || 'Папка';
}

export function triggerBrowserDownload(blobData, filename) {
  const blobUrl = window.URL.createObjectURL(new Blob([blobData]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { buildBreadcrumbs, buildFolderSizes, getApiErrorMessage } from './fileManagerHelpers';

async function fetchFileManagerData(currentFolderId) {
  const ts = Date.now();
  const [foldersRes, filesRes, favsRes] = await Promise.all([
    api.get(`folders/?_ts=${ts}`),
    api.get(`files/?_ts=${ts}`),
    api.get(`favorites/all/?_ts=${ts}`),
  ]);
  const allFolders = foldersRes.data.folders || [];
  const allFiles = filesRes.data || [];
  const accessibleFolderIds = new Set(allFolders.map((folder) => folder.id));
  const visibleFolders = allFolders.map((folder) => ({
    ...folder,
    parent_id: folder.parent_id && accessibleFolderIds.has(folder.parent_id) ? folder.parent_id : null,
  }));
  const visibleFiles = allFiles.map((file) => ({
    ...file,
    folder: file.folder && accessibleFolderIds.has(file.folder) ? file.folder : null,
  }));
  const calculateFolderSize = buildFolderSizes(visibleFolders, visibleFiles);
  return {
    favoriteIds: { files: favsRes.data.file_ids || [], folders: favsRes.data.folder_ids || [] },
    folders: visibleFolders.filter((folder) => folder.parent_id === currentFolderId).map((folder) => ({ ...folder, size: calculateFolderSize(folder.id) })),
    files: visibleFiles.filter((file) => (currentFolderId ? file.folder === currentFolderId : !file.folder)),
    breadcrumbs: buildBreadcrumbs(visibleFolders, currentFolderId),
  };
}

export default function useFileManagerData(currentFolderId, searchQuery) {
  const [favoriteIds, setFavoriteIds] = useState({ files: [], folders: [] });
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchFileManagerData(currentFolderId);
      setFavoriteIds(data.favoriteIds);
      setFolders(data.folders);
      setFiles(data.files);
      setBreadcrumbs(data.breadcrumbs);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    if (!searchQuery.trim()) loadData();
  }, [currentFolderId, loadData, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    const timer = setTimeout(() => searchFiles(searchQuery, setFiles, setFolders, setError, setLoading), 400);
    return () => clearTimeout(timer);
  }, [loadData, searchQuery]);

  return { favoriteIds, folders, files, breadcrumbs, loading, error, setError, success, setSuccess, loadData };
}

async function searchFiles(searchQuery, setFiles, setFolders, setError, setLoading) {
  setLoading(true);
  try {
    const response = await api.get(`/search/?q=${encodeURIComponent(searchQuery)}`);
    const results = response.data.results || [];
    setFiles(results.filter((item) => item.type !== 'folder'));
    setFolders(results.filter((item) => item.type === 'folder'));
    setError('');
  } catch (err) {
    console.error('Ошибка при поиске:', err);
    setError(getApiErrorMessage(err, 'Ошибка при поиске'));
  } finally {
    setLoading(false);
  }
}

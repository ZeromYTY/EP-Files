export const FILE_MANAGER_ITEM_MIME = 'application/x-ep-files-item';

export function setDraggedManagerItem(event, item) {
  if (!event.dataTransfer || item?.type !== 'file') return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(FILE_MANAGER_ITEM_MIME, JSON.stringify({
    id: item.id,
    name: item.name,
    type: item.type,
    folder: item.folder ?? null,
  }));
}

export function hasDraggedManagerItem(event) {
  return Array.from(event.dataTransfer?.types || []).includes(FILE_MANAGER_ITEM_MIME);
}

export function hasDraggedSystemFiles(event) {
  const types = Array.from(event.dataTransfer?.types || []);
  return types.includes('Files') && !types.includes(FILE_MANAGER_ITEM_MIME);
}

export function getDraggedManagerItem(event) {
  if (!hasDraggedManagerItem(event)) return null;
  try {
    const item = JSON.parse(event.dataTransfer.getData(FILE_MANAGER_ITEM_MIME));
    return item?.type === 'file' && item.id ? item : null;
  } catch {
    return null;
  }
}

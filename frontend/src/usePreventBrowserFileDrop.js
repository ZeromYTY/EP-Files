import { useEffect } from 'react';

function shouldPreventDrop(event) {
  const types = Array.from(event.dataTransfer?.types || []);
  return types.includes('Files') || types.includes('application/x-ep-files-item');
}

export default function usePreventBrowserFileDrop() {
  useEffect(() => {
    const preventDefaultFileDrop = (event) => {
      if (!shouldPreventDrop(event)) return;
      event.preventDefault();
    };

    window.addEventListener('dragover', preventDefaultFileDrop);
    window.addEventListener('drop', preventDefaultFileDrop);

    return () => {
      window.removeEventListener('dragover', preventDefaultFileDrop);
      window.removeEventListener('drop', preventDefaultFileDrop);
    };
  }, []);
}

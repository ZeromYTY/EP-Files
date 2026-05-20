import React, { useState, useEffect } from 'react';

const FilePreviewModal = ({ file, onClose }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (file.type === 'text') {
      setLoading(true);
      fetch(file.url)
        .then((res) => {
          if (!res.ok) throw new Error('Файл не найден или доступ ограничен');
          return res.text();
        })
        .then((data) => {
          setContent(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setLoading(false); // Для картинок лоадер не нужен (браузер сам их грузит)
    }
  }, [file]);

  return (
    // Overlay (закрытие при клике на фон)
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800 leading-tight">{file.name}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">
              {file.type} • {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            ✕
          </button>
        </div>

        
        <div className="flex-1 overflow-auto bg-gray-50 p-6 flex justify-center items-center">
          {loading ? (
            <div className="text-center text-gray-400">Загрузка данных...</div>
          ) : error ? (
            <div className="text-center p-8 bg-red-50 rounded-lg border border-red-100">
              <p className="text-red-500 font-medium">⚠️ Ошибка предпросмотра</p>
              <p className="text-red-400 text-sm mt-1">{error}</p>
            </div>
          ) : (
            <>
              {file.type === 'image' ? (
                <img 
                  src={file.url} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain shadow-lg rounded-md"
                />
              ) : (
                <pre className="w-full h-full bg-white p-6 rounded-md border border-gray-200 font-mono text-sm text-gray-700 whitespace-pre-wrap shadow-inner overflow-y-auto">
                  {content}
                </pre>
              )}
            </>
          )}
        </div>

        
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
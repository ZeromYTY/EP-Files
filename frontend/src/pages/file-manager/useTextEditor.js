import { useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from './fileManagerHelpers';

export default function useTextEditor({ setError, setSuccess, loadData }) {
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [textEditorFile, setTextEditorFile] = useState(null);
  const [textEditorContent, setTextEditorContent] = useState('');
  const [textEditorLoading, setTextEditorLoading] = useState(false);
  const [textEditorSaving, setTextEditorSaving] = useState(false);
  const [textEditorError, setTextEditorError] = useState('');

  const closeTextEditor = () => {
    setTextEditorOpen(false); setTextEditorFile(null); setTextEditorContent('');
    setTextEditorError(''); setTextEditorLoading(false); setTextEditorSaving(false);
  };

  const openTextFileEditor = async (file) => {
    if (!file) return;
    setTextEditorError('');
    setTextEditorLoading(true);
    try {
      const response = await api.get(`/files/${file.id}/content/`);
      setTextEditorFile(file);
      setTextEditorContent(response.data.content || '');
      setTextEditorOpen(true);
    } catch (err) {
      console.error('Ошибка при загрузке содержимого файла:', err);
      setError(getApiErrorMessage(err, 'Не удалось загрузить содержимое файла'));
    } finally {
      setTextEditorLoading(false);
    }
  };

  const handleTextEditorSave = async () => {
    if (!textEditorFile) return;
    setTextEditorSaving(true);
    setTextEditorError('');
    try {
      await api.post(`/files/${textEditorFile.id}/save/`, { content: textEditorContent });
      setSuccess('Файл успешно сохранён');
      closeTextEditor();
      loadData();
    } catch (err) {
      console.error('Ошибка при сохранении файла:', err);
      setTextEditorError(getApiErrorMessage(err, 'Не удалось сохранить файл'));
    } finally {
      setTextEditorSaving(false);
    }
  };

  return { textEditorOpen, textEditorFile, textEditorContent, textEditorLoading, textEditorSaving, textEditorError, setTextEditorContent, openTextFileEditor, closeTextEditor, handleTextEditorSave };
}

import { useEffect, useState } from 'react';
import api from './api/axios';

const previewGroups = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'],
  video: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mpeg', 'mpg', 'avi'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'],
  text: ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'xml', 'csv', 'log', 'py', 'java', 'c', 'cpp', 'sh'],
  office: ['docx', 'pptx', 'xlsx'],
};

function getPreviewType(fileName) {
  const extension = fileName?.split('.')?.pop()?.toLowerCase() || '';
  if (extension === 'pdf') return 'pdf';
  return Object.entries(previewGroups).find(([, extensions]) => extensions.includes(extension))?.[0] || 'unsupported';
}

function getExtension(fileName) {
  return fileName?.split('.')?.pop()?.toLowerCase() || '';
}

function getDownloadPath(file) {
  return file.download_url ? file.download_url.replace(/^\/api/, '') : `/files/${file.id}/download/`;
}

function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function getUint16(view, offset) {
  return view.getUint16(offset, true);
}

function getUint32(view, offset) {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (getUint32(view, offset) === 0x06054b50) return offset;
  }
  throw new Error('Не удалось прочитать структуру Office-файла');
}

async function inflateRaw(bytes) {
  if (!('DecompressionStream' in window)) {
    throw new Error('Ваш браузер не поддерживает распаковку Office-файлов для предпросмотра');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = getUint16(view, eocdOffset + 10);
  let centralOffset = getUint32(view, eocdOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (getUint32(view, centralOffset) !== 0x02014b50) break;
    const method = getUint16(view, centralOffset + 10);
    const compressedSize = getUint32(view, centralOffset + 20);
    const nameLength = getUint16(view, centralOffset + 28);
    const extraLength = getUint16(view, centralOffset + 30);
    const commentLength = getUint16(view, centralOffset + 32);
    const localOffset = getUint32(view, centralOffset + 42);
    const name = decodeText(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));
    const localNameLength = getUint16(view, localOffset + 26);
    const localExtraLength = getUint16(view, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    entries.set(name, method === 0 ? compressed : await inflateRaw(compressed));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function parseXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Не удалось прочитать XML внутри Office-файла');
  return doc;
}

function nodesByLocalName(root, localName) {
  return Array.from(root.getElementsByTagName('*')).filter((node) => node.localName === localName);
}

function textByLocalName(root, localName) {
  return nodesByLocalName(root, localName).map((node) => node.textContent || '').filter(Boolean);
}

function firstTextByLocalName(root, localName) {
  return textByLocalName(root, localName)[0] || '';
}

function parseDocx(entries) {
  const documentXml = entries.get('word/document.xml');
  if (!documentXml) throw new Error('Не удалось найти содержимое Word-файла');
  const doc = parseXml(decodeText(documentXml));
  const paragraphs = nodesByLocalName(doc, 'p').map((paragraph) => textByLocalName(paragraph, 't').join('').trim()).filter(Boolean);
  return { type: 'document', paragraphs };
}

function parsePptx(entries) {
  const slideNames = Array.from(entries.keys()).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
  const slides = slideNames.map((name, index) => {
    const doc = parseXml(decodeText(entries.get(name)));
    return { title: `Слайд ${index + 1}`, lines: textByLocalName(doc, 't').map((text) => text.trim()).filter(Boolean) };
  }).filter((slide) => slide.lines.length > 0);
  return { type: 'presentation', slides };
}

function parseXlsx(entries) {
  const sharedXml = entries.get('xl/sharedStrings.xml');
  const sharedStrings = sharedXml ? textByLocalName(parseXml(decodeText(sharedXml)), 't') : [];
  const sheetName = Array.from(entries.keys()).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error('Не удалось найти лист Excel-файла');
  const doc = parseXml(decodeText(entries.get(sheetName)));
  const rows = nodesByLocalName(doc, 'row').slice(0, 30).map((row) => (
    nodesByLocalName(row, 'c').slice(0, 12).map((cell) => {
      const rawValue = firstTextByLocalName(cell, 'v') || firstTextByLocalName(cell, 't');
      if (cell.getAttribute('t') === 's') return sharedStrings[Number(rawValue)] || '';
      return rawValue;
    })
  )).filter((row) => row.some(Boolean));
  return { type: 'spreadsheet', rows };
}

async function parseOfficePreview(fileName, arrayBuffer) {
  const entries = await readZipEntries(arrayBuffer);
  const extension = getExtension(fileName);
  if (extension === 'docx') return parseDocx(entries);
  if (extension === 'pptx') return parsePptx(entries);
  if (extension === 'xlsx') return parseXlsx(entries);
  throw new Error('Предпросмотр доступен только для DOCX, PPTX и XLSX');
}

function usePreview(file) {
  const [state, setState] = useState({ content: '', previewUrl: null, office: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    const loadPreview = async () => {
      const previewType = getPreviewType(file.name);
      setState({ content: '', previewUrl: null, office: null, loading: true, error: null });
      if (previewType === 'unsupported') return setState({ content: '', previewUrl: null, office: null, loading: false, error: `Предпросмотр недоступен для файла ${file.name}` });
      try {
        const response = await api.get(getDownloadPath(file), { responseType: previewType === 'text' ? 'text' : 'arraybuffer' });
        if (cancelled) return;
        if (previewType === 'text') setState({ content: response.data, previewUrl: null, office: null, loading: false, error: null });
        else if (previewType === 'office') {
          const office = await parseOfficePreview(file.name, response.data);
          if (!cancelled) setState({ content: '', previewUrl: null, office, loading: false, error: null });
        } else {
          objectUrl = URL.createObjectURL(new Blob([response.data]));
          setState({ content: '', previewUrl: objectUrl, office: null, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) setState({ content: '', previewUrl: null, office: null, loading: false, error: err.response?.data?.detail || err.message || 'Не удалось загрузить файл для предпросмотра' });
      }
    };
    loadPreview();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file]);
  return state;
}

function OfficePreview({ office }) {
  if (!office) return null;
  if (office.type === 'spreadsheet') {
    return (
      <table style={{ borderCollapse: 'collapse', width: '100%', background: '#fff', fontSize: 13 }}>
        <tbody>
          {office.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`} style={{ border: '1px solid #e2e8f0', padding: '8px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (office.type === 'presentation') {
    return (
      <div style={{ width: '100%', maxHeight: '70vh', overflow: 'auto', display: 'grid', gap: 12 }}>
        {office.slides.map((slide) => (
          <section key={slide.title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <strong style={{ display: 'block', marginBottom: 8 }}>{slide.title}</strong>
            {slide.lines.map((line, index) => <p key={`${slide.title}-${index}`} style={{ margin: '4px 0' }}>{line}</p>)}
          </section>
        ))}
      </div>
    );
  }
  return <div style={{ width: '100%', maxHeight: '70vh', overflow: 'auto', background: '#fff', padding: 18, borderRadius: 8 }}>{office.paragraphs.map((paragraph, index) => <p key={`paragraph-${index}`} style={{ margin: '0 0 10px', lineHeight: 1.55 }}>{paragraph}</p>)}</div>;
}

function PreviewContent({ file, state }) {
  const type = getPreviewType(file.name);
  const mediaStyle = { maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 };
  if (state.loading) return <div style={{ color: '#9ca3af' }}>Загрузка данных...</div>;
  if (state.error) return <div style={{ color: '#b91c1c', fontWeight: 600 }}>{state.error}</div>;
  if (type === 'image') return <img src={state.previewUrl} alt="Preview" style={mediaStyle} />;
  if (type === 'video') return <video src={state.previewUrl} style={{ ...mediaStyle, width: '100%', background: '#000' }} controls />;
  if (type === 'audio') return <audio src={state.previewUrl} controls style={{ width: '100%' }} />;
  if (type === 'pdf') return <object data={state.previewUrl} type="application/pdf" style={{ width: '100%', height: '70vh' }} />;
  if (type === 'office') return <OfficePreview office={state.office} />;
  return <pre style={{ width: '100%', maxHeight: '70vh', overflow: 'auto', background: '#fff', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{state.content}</pre>;
}

const baseButtonStyle = {
  border: '1px solid transparent',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  minHeight: 38,
  padding: '9px 16px',
  transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
};

const downloadButtonStyle = {
  ...baseButtonStyle,
  background: '#dcefe3',
  borderColor: '#b7dbc5',
  color: '#1f6b43',
  boxShadow: '0 6px 16px rgba(31, 107, 67, 0.12)',
};

const closeButtonStyle = {
  ...baseButtonStyle,
  background: '#f4dddd',
  borderColor: '#e4bbbb',
  color: '#8a2f2f',
  boxShadow: '0 6px 16px rgba(138, 47, 47, 0.12)',
};

async function downloadFile(file, setError, setDownloading) {
  setDownloading(true);
  try {
    const response = await api.get(getDownloadPath(file), { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = blobUrl; link.setAttribute('download', file.name); link.click(); URL.revokeObjectURL(blobUrl);
  } catch (err) {
    setError(err.response?.data?.detail || err.message || 'Не удалось скачать файл');
  } finally {
    setDownloading(false);
  }
}

export default function FilePreviewModal({ file, onClose }) {
  const state = usePreview(file);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [hoveredButton, setHoveredButton] = useState('');
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const closeButtonCurrentStyle = {
    ...closeButtonStyle,
    ...(hoveredButton === 'close' ? { background: '#efd0d0', borderColor: '#dca7a7', boxShadow: '0 8px 20px rgba(138, 47, 47, 0.16)', transform: 'translateY(-1px)' } : {}),
  };
  const downloadButtonCurrentStyle = {
    ...downloadButtonStyle,
    ...(hoveredButton === 'download' && !downloading ? { background: '#cfe8d8', borderColor: '#a7d0b7', boxShadow: '0 8px 20px rgba(31, 107, 67, 0.16)', transform: 'translateY(-1px)' } : {}),
    ...(downloading ? { cursor: 'not-allowed', opacity: 0.68, transform: 'none' } : {}),
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 2000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(95vw, 920px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'center', padding: 16, borderBottom: '1px solid #eef2f7' }}><strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</strong></div>
        <div style={{ flex: 1, overflow: 'auto', background: '#f7fafc', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PreviewContent file={file} state={{ ...state, error: state.error || downloadError }} /></div>
        <div style={{ padding: 14, borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', gap: 12 }}><button type="button" style={downloadButtonCurrentStyle} onMouseEnter={() => setHoveredButton('download')} onMouseLeave={() => setHoveredButton('')} onClick={() => downloadFile(file, setDownloadError, setDownloading)} disabled={downloading}>{downloading ? 'Скачивание...' : 'Скачать'}</button><button type="button" style={closeButtonCurrentStyle} onMouseEnter={() => setHoveredButton('close')} onMouseLeave={() => setHoveredButton('')} onClick={onClose}>Закрыть</button></div>
      </div>
    </div>
  );
}

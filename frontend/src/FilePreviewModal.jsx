import { useEffect, useState } from 'react';
import api from './api/axios';

const previewGroups = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'],
  video: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mpeg', 'mpg', 'avi'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'],
  text: ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'xml', 'csv', 'log', 'py', 'java', 'c', 'cpp', 'sh'],
  office: ['docx', 'pptx', 'xlsx', 'xls'],
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

function parseRelationshipId(attributeName) {
  return attributeName.includes(':') ? attributeName.split(':').pop() : attributeName;
}

function getRelationshipTarget(entries, relsPath, relationshipId) {
  const relsXml = entries.get(relsPath);
  if (!relsXml) return '';
  const relsDoc = parseXml(decodeText(relsXml));
  const relationship = nodesByLocalName(relsDoc, 'Relationship').find((node) => node.getAttribute('Id') === relationshipId);
  return relationship?.getAttribute('Target') || '';
}

function normalizeWorksheetPath(target) {
  if (!target) return '';
  if (target.startsWith('/')) return target.slice(1);
  if (target.startsWith('xl/')) return target;
  return `xl/${target}`;
}

function columnIndexFromLetters(letters) {
  return letters.split('').reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function columnNameFromIndex(index) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function parseCellReference(reference) {
  const match = /^([A-Z]+)(\d+)$/i.exec(reference || '');
  if (!match) return null;
  return {
    columnIndex: columnIndexFromLetters(match[1].toUpperCase()),
    rowIndex: Number(match[2]) - 1,
  };
}

function getInlineString(cell) {
  const inlineString = nodesByLocalName(cell, 'is')[0];
  if (!inlineString) return '';
  return textByLocalName(inlineString, 't').join('');
}

function getCellValue(cell, sharedStrings) {
  const type = cell.getAttribute('t');
  const rawValue = firstTextByLocalName(cell, 'v');
  if (type === 's') return sharedStrings[Number(rawValue)] || '';
  if (type === 'inlineStr') return getInlineString(cell);
  if (type === 'b') return rawValue === '1' ? 'TRUE' : rawValue === '0' ? 'FALSE' : rawValue;
  if (type === 'str') return rawValue || firstTextByLocalName(cell, 't');
  return rawValue;
}

function parseSharedStrings(entries) {
  const sharedXml = entries.get('xl/sharedStrings.xml');
  if (!sharedXml) return [];
  return nodesByLocalName(parseXml(decodeText(sharedXml)), 'si').map((item) => textByLocalName(item, 't').join(''));
}

function childNodesByLocalName(root, localName) {
  return Array.from(root.children || []).filter((node) => node.localName === localName);
}

const indexedColors = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
];

const builtInNumberFormats = {
  14: 'm/d/yy',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  22: 'm/d/yy h:mm',
  27: '[$-404]e/m/d',
  30: 'm/d/yy',
  36: '[$-404]e/m/d',
  45: 'mm:ss',
  46: '[h]:mm:ss',
  47: 'mmss.0',
  50: '[$-404]e/m/d',
  57: '[$-404]e/m/d',
};

function normalizeHexColor(value) {
  if (!value) return '';
  const hex = value.replace('#', '').toUpperCase();
  if (hex.length === 8) return hex.slice(2);
  if (hex.length === 6) return hex;
  return '';
}

function applyTint(hexColor, tintValue) {
  const tint = Number(tintValue || 0);
  if (!hexColor || !tint) return hexColor;
  const channels = [0, 2, 4].map((offset) => parseInt(hexColor.slice(offset, offset + 2), 16));
  const tinted = channels.map((channel) => {
    const next = tint < 0 ? channel * (1 + tint) : channel + (255 - channel) * tint;
    return Math.max(0, Math.min(255, Math.round(next))).toString(16).padStart(2, '0').toUpperCase();
  });
  return tinted.join('');
}

function parseThemeColors(entries) {
  const themeXml = entries.get('xl/theme/theme1.xml');
  if (!themeXml) return [];
  const themeDoc = parseXml(decodeText(themeXml));
  const scheme = nodesByLocalName(themeDoc, 'clrScheme')[0];
  if (!scheme) return [];
  const order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  return order.map((name) => {
    const item = childNodesByLocalName(scheme, name)[0];
    const srgb = nodesByLocalName(item || scheme, 'srgbClr')[0]?.getAttribute('val');
    const system = nodesByLocalName(item || scheme, 'sysClr')[0]?.getAttribute('lastClr');
    return normalizeHexColor(srgb || system);
  });
}

function parseColor(colorNode, themeColors) {
  if (!colorNode) return '';
  const rgb = normalizeHexColor(colorNode.getAttribute('rgb'));
  if (rgb) return `#${rgb}`;
  const indexed = colorNode.getAttribute('indexed');
  if (indexed !== null) return indexedColors[Number(indexed)] ? `#${indexedColors[Number(indexed)]}` : '';
  const themeIndex = colorNode.getAttribute('theme');
  if (themeIndex !== null) {
    const themeColor = applyTint(themeColors[Number(themeIndex)], colorNode.getAttribute('tint'));
    return themeColor ? `#${themeColor}` : '';
  }
  return '';
}

function parseFont(fontNode, themeColors) {
  if (!fontNode) return {};
  return {
    fontWeight: childNodesByLocalName(fontNode, 'b').length ? 700 : undefined,
    fontStyle: childNodesByLocalName(fontNode, 'i').length ? 'italic' : undefined,
    textDecoration: childNodesByLocalName(fontNode, 'u').length ? 'underline' : undefined,
    color: parseColor(childNodesByLocalName(fontNode, 'color')[0], themeColors) || undefined,
    fontSize: childNodesByLocalName(fontNode, 'sz')[0]?.getAttribute('val') ? `${childNodesByLocalName(fontNode, 'sz')[0].getAttribute('val')}pt` : undefined,
    fontFamily: childNodesByLocalName(fontNode, 'name')[0]?.getAttribute('val') || undefined,
  };
}

function parseFill(fillNode, themeColors) {
  const pattern = nodesByLocalName(fillNode, 'patternFill')[0];
  if (!pattern || ['none', 'gray125'].includes(pattern.getAttribute('patternType'))) return {};
  const fgColor = parseColor(childNodesByLocalName(pattern, 'fgColor')[0], themeColors);
  const bgColor = parseColor(childNodesByLocalName(pattern, 'bgColor')[0], themeColors);
  return { backgroundColor: fgColor || bgColor || undefined };
}

function mapBorderStyle(style) {
  if (!style) return '';
  if (['dashed', 'dashDot', 'dashDotDot', 'slantDashDot'].includes(style)) return 'dashed';
  if (['dotted', 'hair'].includes(style)) return 'dotted';
  if (['double'].includes(style)) return 'double';
  return 'solid';
}

function parseBorderSide(sideNode, themeColors) {
  const style = sideNode?.getAttribute('style');
  if (!style) return '';
  const width = ['medium', 'thick', 'double'].includes(style) ? 2 : 1;
  const color = parseColor(childNodesByLocalName(sideNode, 'color')[0], themeColors) || '#94a3b8';
  return `${width}px ${mapBorderStyle(style)} ${color}`;
}

function parseBorder(borderNode, themeColors) {
  if (!borderNode) return {};
  return {
    borderTop: parseBorderSide(childNodesByLocalName(borderNode, 'top')[0], themeColors) || undefined,
    borderRight: parseBorderSide(childNodesByLocalName(borderNode, 'right')[0], themeColors) || undefined,
    borderBottom: parseBorderSide(childNodesByLocalName(borderNode, 'bottom')[0], themeColors) || undefined,
    borderLeft: parseBorderSide(childNodesByLocalName(borderNode, 'left')[0], themeColors) || undefined,
  };
}

function parseAlignment(xfNode) {
  const alignment = childNodesByLocalName(xfNode, 'alignment')[0];
  if (!alignment) return {};
  return {
    textAlign: alignment.getAttribute('horizontal') || undefined,
    verticalAlign: alignment.getAttribute('vertical') || undefined,
    whiteSpace: alignment.getAttribute('wrapText') === '1' ? 'normal' : undefined,
  };
}

function parseStyles(entries) {
  const stylesXml = entries.get('xl/styles.xml');
  if (!stylesXml) return { cellStyles: [], columnStyles: [], numberFormats: {} };
  const themeColors = parseThemeColors(entries);
  const stylesDoc = parseXml(decodeText(stylesXml));
  const numberFormats = {};
  nodesByLocalName(stylesDoc, 'numFmt').forEach((node) => {
    numberFormats[Number(node.getAttribute('numFmtId'))] = node.getAttribute('formatCode') || '';
  });
  const fonts = childNodesByLocalName(nodesByLocalName(stylesDoc, 'fonts')[0] || {}, 'font').map((node) => parseFont(node, themeColors));
  const fills = childNodesByLocalName(nodesByLocalName(stylesDoc, 'fills')[0] || {}, 'fill').map((node) => parseFill(node, themeColors));
  const borders = childNodesByLocalName(nodesByLocalName(stylesDoc, 'borders')[0] || {}, 'border').map((node) => parseBorder(node, themeColors));
  const cellStyles = childNodesByLocalName(nodesByLocalName(stylesDoc, 'cellXfs')[0] || {}, 'xf').map((xf) => ({
    css: {
      ...(fills[Number(xf.getAttribute('fillId') || 0)] || {}),
      ...(fonts[Number(xf.getAttribute('fontId') || 0)] || {}),
      ...(borders[Number(xf.getAttribute('borderId') || 0)] || {}),
      ...parseAlignment(xf),
    },
    numberFormat: numberFormats[Number(xf.getAttribute('numFmtId'))] || builtInNumberFormats[Number(xf.getAttribute('numFmtId'))] || '',
  }));
  return { cellStyles, numberFormats };
}

function isDateFormat(formatCode) {
  return /(^|[^\\])([ymdhs])/.test((formatCode || '').replace(/\[[^\]]*]/g, '').toLowerCase());
}

function excelSerialToDate(serial) {
  const days = Number(serial);
  if (!Number.isFinite(days)) return '';
  const utc = Date.UTC(1899, 11, 30) + days * 86400000;
  return new Date(utc);
}

function formatDateValue(value, formatCode) {
  const date = excelSerialToDate(value);
  if (!date || Number.isNaN(date.getTime())) return value;
  const hasTime = /h|s/i.test(formatCode || '');
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function formatCellValue(rawValue, type, style) {
  if (type === 'n' && isDateFormat(style?.numberFormat)) return formatDateValue(rawValue, style.numberFormat);
  return rawValue;
}

function parseWorkbookSheets(entries) {
  const workbookXml = entries.get('xl/workbook.xml');
  if (!workbookXml) return [];
  const workbookDoc = parseXml(decodeText(workbookXml));
  return nodesByLocalName(workbookDoc, 'sheet').map((sheet, index) => {
    const relationshipAttribute = Array.from(sheet.attributes).find((attribute) => parseRelationshipId(attribute.name) === 'id');
    const target = getRelationshipTarget(entries, 'xl/_rels/workbook.xml.rels', relationshipAttribute?.value);
    return {
      id: sheet.getAttribute('sheetId') || String(index + 1),
      name: sheet.getAttribute('name') || `Лист ${index + 1}`,
      path: normalizeWorksheetPath(target || `worksheets/sheet${index + 1}.xml`),
    };
  });
}

function parseRangeReference(range) {
  const [start, end = start] = (range || '').split(':');
  const startRef = parseCellReference(start);
  const endRef = parseCellReference(end);
  if (!startRef || !endRef) return null;
  return {
    startRow: Math.min(startRef.rowIndex, endRef.rowIndex),
    endRow: Math.max(startRef.rowIndex, endRef.rowIndex),
    startColumn: Math.min(startRef.columnIndex, endRef.columnIndex),
    endColumn: Math.max(startRef.columnIndex, endRef.columnIndex),
  };
}

function parseSheetDimension(doc) {
  const dimensionRef = nodesByLocalName(doc, 'dimension')[0]?.getAttribute('ref');
  const range = parseRangeReference(dimensionRef);
  if (!range) return { maxRowIndex: 0, maxColumnIndex: 0 };
  return { maxRowIndex: range.endRow, maxColumnIndex: range.endColumn };
}

function parseColumnDimensions(doc, styles) {
  const dimensions = {};
  nodesByLocalName(doc, 'col').forEach((col) => {
    const min = Number(col.getAttribute('min') || 1) - 1;
    const max = Number(col.getAttribute('max') || min + 1) - 1;
    for (let index = min; index <= max; index += 1) {
      dimensions[index] = {
        width: col.getAttribute('hidden') === '1' ? 0 : Math.max(44, Math.round(Number(col.getAttribute('width') || 10) * 7)),
        style: styles.cellStyles[Number(col.getAttribute('style'))]?.css || {},
        hidden: col.getAttribute('hidden') === '1',
      };
    }
  });
  return dimensions;
}

function parseRowDimensions(doc) {
  const dimensions = {};
  nodesByLocalName(doc, 'row').forEach((row) => {
    const rowIndex = Number(row.getAttribute('r') || 1) - 1;
    dimensions[rowIndex] = {
      height: row.getAttribute('hidden') === '1' ? 0 : Math.max(22, Math.round(Number(row.getAttribute('ht') || 19) * 1.33)),
      hidden: row.getAttribute('hidden') === '1',
    };
  });
  return dimensions;
}

function parseMergedCells(doc) {
  const masters = new Map();
  const covered = new Set();
  nodesByLocalName(doc, 'mergeCell').forEach((node) => {
    const range = parseRangeReference(node.getAttribute('ref'));
    if (!range) return;
    const rowSpan = range.endRow - range.startRow + 1;
    const colSpan = range.endColumn - range.startColumn + 1;
    masters.set(`${range.startRow}:${range.startColumn}`, { rowSpan, colSpan });
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      for (let col = range.startColumn; col <= range.endColumn; col += 1) {
        if (row !== range.startRow || col !== range.startColumn) covered.add(`${row}:${col}`);
      }
    }
  });
  return { masters, covered };
}

function parseWorksheet(entries, sheet, sharedStrings, styles) {
  const sheetXml = entries.get(sheet.path);
  if (!sheetXml) return null;
  const doc = parseXml(decodeText(sheetXml));
  const cells = new Map();
  const dimension = parseSheetDimension(doc);
  const columnDimensions = parseColumnDimensions(doc, styles);
  const rowDimensions = parseRowDimensions(doc);
  const merged = parseMergedCells(doc);
  let maxColumnIndex = dimension.maxColumnIndex;
  let maxRowIndex = dimension.maxRowIndex;

  nodesByLocalName(doc, 'row').forEach((rowNode, fallbackRowIndex) => {
    const rowIndex = Number(rowNode.getAttribute('r') || fallbackRowIndex + 1) - 1;
    maxRowIndex = Math.max(maxRowIndex, rowIndex);
    nodesByLocalName(rowNode, 'c').forEach((cellNode, fallbackColumnIndex) => {
      const reference = parseCellReference(cellNode.getAttribute('r')) || { rowIndex, columnIndex: fallbackColumnIndex };
      const style = styles.cellStyles[Number(cellNode.getAttribute('s'))] || {};
      const rawValue = getCellValue(cellNode, sharedStrings);
      const value = formatCellValue(rawValue, cellNode.getAttribute('t') || 'n', style);
      const hasStyle = cellNode.getAttribute('s') !== null;
      if (!value && !hasStyle && !merged.masters.has(`${reference.rowIndex}:${reference.columnIndex}`)) return;
      cells.set(`${reference.rowIndex}:${reference.columnIndex}`, {
        rowIndex: reference.rowIndex,
        columnIndex: reference.columnIndex,
        value,
        style: { ...(columnDimensions[reference.columnIndex]?.style || {}), ...(style.css || {}) },
        span: merged.masters.get(`${reference.rowIndex}:${reference.columnIndex}`) || null,
      });
      maxRowIndex = Math.max(maxRowIndex, reference.rowIndex);
      maxColumnIndex = Math.max(maxColumnIndex, reference.columnIndex);
    });
  });

  const rowCount = maxRowIndex + 1;
  const columnCount = maxColumnIndex + 1;
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => Array.from({ length: columnCount }, (_, columnIndex) => {
    if (merged.covered.has(`${rowIndex}:${columnIndex}`)) return { hiddenByMerge: true };
    return cells.get(`${rowIndex}:${columnIndex}`) || {
      rowIndex,
      columnIndex,
      value: '',
      style: columnDimensions[columnIndex]?.style || {},
      span: merged.masters.get(`${rowIndex}:${columnIndex}`) || null,
    };
  }));
  const columns = Array.from({ length: columnCount }, (_, index) => columnDimensions[index] || { width: 120, style: {}, hidden: false });
  const rowMeta = Array.from({ length: rowCount }, (_, index) => rowDimensions[index] || { height: 25, hidden: false });

  return {
    ...sheet,
    rowCount,
    columnCount,
    totalRows: maxRowIndex + 1,
    totalColumns: maxColumnIndex + 1,
    columns,
    rowMeta,
    rows,
  };
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
  const sharedStrings = parseSharedStrings(entries);
  const styles = parseStyles(entries);
  const workbookSheets = parseWorkbookSheets(entries);
  const fallbackSheets = Array.from(entries.keys())
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0))
    .map((path, index) => ({ id: String(index + 1), name: `Лист ${index + 1}`, path }));
  const sheets = (workbookSheets.length ? workbookSheets : fallbackSheets)
    .map((sheet) => parseWorksheet(entries, sheet, sharedStrings, styles))
    .filter(Boolean);
  if (!sheets.length) throw new Error('Не удалось найти лист Excel-файла');
  return { type: 'spreadsheet', sheets };
}

async function parseOfficePreview(fileName, arrayBuffer) {
  const entries = await readZipEntries(arrayBuffer);
  const extension = getExtension(fileName);
  if (extension === 'docx') return parseDocx(entries);
  if (extension === 'pptx') return parsePptx(entries);
  if (extension === 'xlsx') return parseXlsx(entries);
  if (extension === 'xls') throw new Error('Предпросмотр старого формата XLS пока недоступен. Сохраните файл как XLSX или скачайте оригинал.');
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

function SpreadsheetPreview({ office }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const activeSheet = office.sheets[Math.min(activeSheetIndex, office.sheets.length - 1)];
  if (!activeSheet) return <div style={{ color: '#64748b' }}>В книге нет данных для предпросмотра.</div>;

  return (
    <div style={{ width: '100%', height: '70vh', minHeight: 360, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #dbe3ee', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeSheet.name}</strong>
          <span style={{ color: '#64748b', fontSize: 12 }}>{activeSheet.totalRows} строк, {activeSheet.totalColumns} колонок</span>
        </div>
      </div>
      {office.sheets.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid #e2e8f0', background: '#fff', overflowX: 'auto' }}>
          {office.sheets.map((sheet, index) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => setActiveSheetIndex(index)}
              style={{
                border: `1px solid ${index === activeSheetIndex ? '#2563eb' : '#cbd5e1'}`,
                borderRadius: 6,
                background: index === activeSheetIndex ? '#dbeafe' : '#fff',
                color: index === activeSheetIndex ? '#1d4ed8' : '#334155',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 10px',
                whiteSpace: 'nowrap',
              }}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%', background: '#fff', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 48 }} />
            {activeSheet.columns.map((column, index) => <col key={`width-${index}`} style={{ width: column.hidden ? 0 : column.width }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, width: 48, minWidth: 48, background: '#eef2f7', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }} />
              {activeSheet.columns.map((column, index) => (
                <th key={`col-${index}`} style={{ position: 'sticky', top: 0, zIndex: 2, width: column.hidden ? 0 : column.width, minWidth: column.hidden ? 0 : 44, background: '#eef2f7', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, padding: column.hidden ? 0 : '7px 10px', textAlign: 'center', overflow: 'hidden' }}>{column.hidden ? '' : columnNameFromIndex(index)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSheet.rows.map((row, rowIndex) => activeSheet.rowMeta[rowIndex]?.hidden ? null : (
              <tr key={`row-${rowIndex}`} style={{ height: activeSheet.rowMeta[rowIndex]?.height }}>
                <th style={{ position: 'sticky', left: 0, zIndex: 1, width: 48, minWidth: 48, background: '#f8fafc', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, padding: activeSheet.rowMeta[rowIndex]?.hidden ? 0 : '7px 8px', textAlign: 'right', overflow: 'hidden' }}>{activeSheet.rowMeta[rowIndex]?.hidden ? '' : rowIndex + 1}</th>
                {row.map((cell, cellIndex) => {
                  if (cell.hiddenByMerge || activeSheet.columns[cellIndex]?.hidden) return null;
                  const span = cell.span || {};
                  return (
                    <td
                      key={`cell-${rowIndex}-${cellIndex}`}
                      colSpan={span.colSpan}
                      rowSpan={span.rowSpan}
                      title={cell.value}
                      style={{
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                        color: '#0f172a',
                        backgroundColor: '#fff',
                        minWidth: 44,
                        padding: '5px 8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.35,
                        ...cell.style,
                      }}
                    >
                      {cell.value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OfficePreview({ office }) {
  if (!office) return null;
  if (office.type === 'spreadsheet') return <SpreadsheetPreview office={office} />;
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

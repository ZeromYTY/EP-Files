import { useEffect, useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import api from './api/axios';

const previewGroups = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'],
  video: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mpeg', 'mpg', 'avi'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'],
  text: ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'xml', 'csv', 'log', 'py', 'java', 'c', 'cpp', 'sh'],
  office: ['docx', 'ppt', 'pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm', 'xlsx', 'xls'],
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

function getPreviewMime(previewType, fileName, responseType = '') {
  if (responseType && !responseType.includes('octet-stream')) return responseType;
  if (previewType === 'pdf') return 'application/pdf';
  if (previewType === 'image') return `image/${getExtension(fileName) === 'jpg' ? 'jpeg' : getExtension(fileName)}`;
  if (previewType === 'video') return `video/${getExtension(fileName)}`;
  if (previewType === 'audio') return `audio/${getExtension(fileName)}`;
  return 'application/octet-stream';
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
  if (!root?.getElementsByTagName) return [];
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

function parseThemeColors(entries, themePath = 'xl/theme/theme1.xml') {
  const themeXml = entries.get(themePath);
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

function getAttributeByLocalName(node, localName) {
  return Array.from(node?.attributes || []).find((attribute) => parseRelationshipId(attribute.name) === localName)?.value || '';
}

function normalizeZipPath(baseDir, target) {
  if (!target || /^[a-z]+:/i.test(target)) return '';
  if (target.startsWith('/')) return target.slice(1);
  const parts = `${baseDir}/${target}`.split('/');
  const normalized = [];
  parts.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') normalized.pop();
    else normalized.push(part);
  });
  return normalized.join('/');
}

function parseRelationships(entries, relsPath, baseDir) {
  const relsXml = entries.get(relsPath);
  if (!relsXml) return {};
  const relsDoc = parseXml(decodeText(relsXml));
  return Object.fromEntries(nodesByLocalName(relsDoc, 'Relationship').map((node) => [
    node.getAttribute('Id'),
    {
      target: normalizeZipPath(baseDir, node.getAttribute('Target') || ''),
      type: node.getAttribute('Type') || '',
    },
  ]));
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function mimeTypeForImage(path) {
  const extension = getExtension(path);
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  return 'image/png';
}

const pptSchemeColorIndexes = {
  lt1: 0,
  light1: 0,
  bg1: 0,
  dk1: 1,
  dark1: 1,
  tx1: 1,
  lt2: 2,
  light2: 2,
  bg2: 2,
  dk2: 3,
  dark2: 3,
  tx2: 3,
  accent1: 4,
  accent2: 5,
  accent3: 6,
  accent4: 7,
  accent5: 8,
  accent6: 9,
  hlink: 10,
  folHlink: 11,
};

function applyLum(hexColor, lumModValue, lumOffValue) {
  if (!hexColor) return hexColor;
  const lumMod = lumModValue ? Number(lumModValue) / 100000 : 1;
  const lumOff = lumOffValue ? Number(lumOffValue) / 100000 : 0;
  const channels = [0, 2, 4].map((offset) => parseInt(hexColor.slice(offset, offset + 2), 16));
  return channels.map((channel) => Math.max(0, Math.min(255, Math.round((channel * lumMod) + (255 * lumOff)))).toString(16).padStart(2, '0').toUpperCase()).join('');
}

function parseDrawingColor(colorRoot, themeColors) {
  if (!colorRoot) return '';
  const srgb = nodesByLocalName(colorRoot, 'srgbClr')[0]?.getAttribute('val');
  if (srgb) return `#${normalizeHexColor(srgb)}`;
  const system = nodesByLocalName(colorRoot, 'sysClr')[0]?.getAttribute('lastClr');
  if (system) return `#${normalizeHexColor(system)}`;
  const schemeNode = nodesByLocalName(colorRoot, 'schemeClr')[0];
  if (schemeNode) {
    let themeColor = themeColors[pptSchemeColorIndexes[schemeNode.getAttribute('val')]];
    const tint = nodesByLocalName(schemeNode, 'tint')[0]?.getAttribute('val');
    const shade = nodesByLocalName(schemeNode, 'shade')[0]?.getAttribute('val');
    const lumMod = nodesByLocalName(schemeNode, 'lumMod')[0]?.getAttribute('val');
    const lumOff = nodesByLocalName(schemeNode, 'lumOff')[0]?.getAttribute('val');
    if (themeColor) {
      themeColor = applyLum(themeColor, lumMod, lumOff);
      if (tint) return `#${applyTint(themeColor, Number(tint) / 100000)}`;
      if (shade) return `#${applyTint(themeColor, -(1 - Number(shade) / 100000))}`;
      return `#${themeColor}`;
    }
  }
  const preset = nodesByLocalName(colorRoot, 'prstClr')[0]?.getAttribute('val');
  const presetColors = { black: '#000000', white: '#ffffff', red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', gray: '#808080', dkGray: '#404040', ltGray: '#c0c0c0', orange: '#ffa500', purple: '#800080' };
  return presetColors[preset] || '';
}

function hexToRgb(color) {
  const hex = normalizeHexColor(color);
  if (!hex) return null;
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function readableTextColor(backgroundColor) {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return '#111827';
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.42 ? '#111827' : '#ffffff';
}

function parseSolidFill(root, themeColors) {
  const solidFill = childNodesByLocalName(root || {}, 'solidFill')[0] || nodesByLocalName(root || {}, 'solidFill')[0];
  return parseDrawingColor(solidFill, themeColors);
}

function parseSlideSize(entries) {
  const presentationXml = entries.get('ppt/presentation.xml');
  if (!presentationXml) return { width: 12192000, height: 6858000 };
  const doc = parseXml(decodeText(presentationXml));
  const size = nodesByLocalName(doc, 'sldSz')[0];
  return {
    width: Number(size?.getAttribute('cx')) || 12192000,
    height: Number(size?.getAttribute('cy')) || 6858000,
  };
}

function getSlidePaths(entries) {
  const presentationXml = entries.get('ppt/presentation.xml');
  if (!presentationXml) {
    return Array.from(entries.keys()).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
  }
  const doc = parseXml(decodeText(presentationXml));
  const rels = parseRelationships(entries, 'ppt/_rels/presentation.xml.rels', 'ppt');
  const ordered = nodesByLocalName(doc, 'sldId')
    .map((node) => rels[getAttributeByLocalName(node, 'id')]?.target)
    .filter(Boolean);
  return ordered.length ? ordered : Array.from(entries.keys()).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
}

function parseTransform(node, slideSize) {
  const xfrm = nodesByLocalName(node, 'xfrm')[0];
  const off = childNodesByLocalName(xfrm || {}, 'off')[0];
  const ext = childNodesByLocalName(xfrm || {}, 'ext')[0];
  const x = Number(off?.getAttribute('x')) || 0;
  const y = Number(off?.getAttribute('y')) || 0;
  const cx = Number(ext?.getAttribute('cx')) || slideSize.width;
  const cy = Number(ext?.getAttribute('cy')) || slideSize.height;
  return {
    left: `${(x / slideSize.width) * 100}%`,
    top: `${(y / slideSize.height) * 100}%`,
    width: `${(cx / slideSize.width) * 100}%`,
    height: `${(cy / slideSize.height) * 100}%`,
  };
}

function parseLineStyle(spPr, themeColors) {
  const line = childNodesByLocalName(spPr || {}, 'ln')[0];
  if (!line || childNodesByLocalName(line, 'noFill').length) return {};
  const width = Math.max(1, Math.round(Number(line.getAttribute('w') || 9525) / 9525));
  const color = parseSolidFill(line, themeColors);
  return color ? { border: `${width}px solid ${color}` } : {};
}

function parseShapeStyle(spPr, themeColors) {
  if (!spPr) return {};
  const fill = childNodesByLocalName(spPr, 'noFill').length ? '' : parseSolidFill(spPr, themeColors);
  return {
    fillColor: fill,
    css: {
    ...(fill ? { backgroundColor: fill } : {}),
    ...parseLineStyle(spPr, themeColors),
    },
  };
}

function parseRunStyle(run, themeColors) {
  const rPr = childNodesByLocalName(run, 'rPr')[0] || childNodesByLocalName(run, 'endParaRPr')[0];
  const fontSize = Number(rPr?.getAttribute('sz'));
  const color = parseSolidFill(rPr, themeColors);
  return {
    fontWeight: rPr?.getAttribute('b') === '1' ? 700 : undefined,
    fontStyle: rPr?.getAttribute('i') === '1' ? 'italic' : undefined,
    textDecoration: rPr?.getAttribute('u') && rPr.getAttribute('u') !== 'none' ? 'underline' : undefined,
    color: color || undefined,
    fontSize: fontSize ? `${Math.max(8, fontSize / 100)}pt` : undefined,
    fontFamily: nodesByLocalName(rPr || {}, 'latin')[0]?.getAttribute('typeface') || undefined,
  };
}

function parseTextParagraphs(txBody, themeColors) {
  return childNodesByLocalName(txBody || {}, 'p').map((paragraph) => {
    const pPr = childNodesByLocalName(paragraph, 'pPr')[0];
    const runs = childNodesByLocalName(paragraph, 'r').map((run) => ({
      text: firstTextByLocalName(run, 't'),
      style: parseRunStyle(run, themeColors),
    })).filter((run) => run.text);
    return {
      align: pPr?.getAttribute('algn') || 'left',
      runs: runs.length ? runs : [{ text: textByLocalName(paragraph, 't').join(''), style: parseRunStyle(childNodesByLocalName(paragraph, 'endParaRPr')[0] || paragraph, themeColors) }],
    };
  }).filter((paragraph) => paragraph.runs.some((run) => run.text.trim()));
}

function parseSlideBackground(slideDoc, themeColors, fallback = '') {
  const bg = nodesByLocalName(slideDoc, 'bgPr')[0] || nodesByLocalName(slideDoc, 'bgRef')[0];
  return parseSolidFill(bg, themeColors) || parseDrawingColor(bg, themeColors) || fallback;
}

function parseSlideImage(entries, picture, slidePath, slideSize, rels, index) {
    const blip = nodesByLocalName(picture, 'blip')[0];
    const relationshipId = getAttributeByLocalName(blip, 'embed') || getAttributeByLocalName(blip, 'link');
    const mediaPath = rels[relationshipId]?.target;
    const bytes = mediaPath ? entries.get(mediaPath) : null;
    if (!bytes) return null;
    return {
      id: `image-${slidePath}-${index}`,
      kind: 'image',
      box: parseTransform(picture, slideSize),
      src: `data:${mimeTypeForImage(mediaPath)};base64,${bytesToBase64(bytes)}`,
    };
}

function parseSlideShape(shape, slideSize, themeColors, index) {
  const paragraphs = parseTextParagraphs(nodesByLocalName(shape, 'txBody')[0], themeColors);
  const spPr = childNodesByLocalName(shape, 'spPr')[0] || nodesByLocalName(shape, 'spPr')[0];
  if (!paragraphs.length && !spPr) return null;
  const style = parseShapeStyle(spPr, themeColors);
  return {
    id: `shape-${index}`,
    kind: 'text',
    box: parseTransform(shape, slideSize),
    style: style.css,
    fillColor: style.fillColor,
    paragraphs,
  };
}

function parseSlideObjects(entries, slideDoc, slidePath, slideSize, themeColors, rels) {
  const tree = nodesByLocalName(slideDoc, 'spTree')[0];
  const children = childNodesByLocalName(tree || {}, 'sp').concat(childNodesByLocalName(tree || {}, 'pic'));
  const orderedChildren = children.length ? Array.from(tree.children || []).filter((node) => ['sp', 'pic'].includes(node.localName)) : [];
  const source = orderedChildren.length ? orderedChildren : children;
  return source.map((node, index) => {
    if (node.localName === 'pic') return parseSlideImage(entries, node, slidePath, slideSize, rels, index);
    return parseSlideShape(node, slideSize, themeColors, index);
  }).filter(Boolean);
}

function parseSlideLayer(entries, layerPath, slideSize, themeColors) {
  if (!layerPath || !entries.has(layerPath)) return { background: '', objects: [] };
  const doc = parseXml(decodeText(entries.get(layerPath)));
  const baseDir = layerPath.split('/').slice(0, -1).join('/');
  const fileName = layerPath.split('/').pop();
  const rels = parseRelationships(entries, `${baseDir}/_rels/${fileName}.rels`, baseDir);
  return {
    background: parseSlideBackground(doc, themeColors),
    objects: parseSlideObjects(entries, doc, layerPath, slideSize, themeColors, rels),
  };
}

function isRenderableSlideObject(object) {
  if (object.kind !== 'text') return true;
  return Boolean(object.paragraphs?.length || object.style?.backgroundColor || object.style?.border);
}

function parsePptx(entries) {
  const slideSize = parseSlideSize(entries);
  const themeColors = parseThemeColors(entries, 'ppt/theme/theme1.xml');
  const slidePaths = getSlidePaths(entries);
  const slides = slidePaths.map((path, index) => {
    const doc = parseXml(decodeText(entries.get(path)));
    const relationshipPath = path.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const rels = parseRelationships(entries, relationshipPath, 'ppt/slides');
    const layoutPath = Object.values(rels).find((rel) => rel.type.includes('/slideLayout'))?.target;
    const layoutLayer = parseSlideLayer(entries, layoutPath, slideSize, themeColors);
    const masterPath = layoutPath ? Object.values(parseRelationships(entries, `ppt/slideLayouts/_rels/${layoutPath.split('/').pop()}.rels`, 'ppt/slideLayouts')).find((rel) => rel.type.includes('/slideMaster'))?.target : '';
    const masterLayer = parseSlideLayer(entries, masterPath, slideSize, themeColors);
    const slideBackground = parseSlideBackground(doc, themeColors);
    const background = slideBackground || layoutLayer.background || masterLayer.background || '#ffffff';
    const slideObjects = parseSlideObjects(entries, doc, path, slideSize, themeColors, rels);
    return {
      id: path,
      title: `Слайд ${index + 1}`,
      background: background || '#ffffff',
      objects: [
        ...masterLayer.objects.filter(isRenderableSlideObject),
        ...layoutLayer.objects.filter(isRenderableSlideObject),
        ...slideObjects,
      ],
      textColor: readableTextColor(background),
      plainText: textByLocalName(doc, 't').map((text) => text.trim()).filter(Boolean).join(' '),
    };
  });
  if (!slides.length) throw new Error('Не удалось найти слайды PowerPoint-файла');
  return { type: 'presentation', slideSize, slides };
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
  const extension = getExtension(fileName);
  if (extension === 'ppt') throw new Error('Предпросмотр старого бинарного формата PPT пока недоступен. Сохраните презентацию как PPTX или скачайте оригинал.');
  if (extension === 'xls') throw new Error('Предпросмотр старого формата XLS пока недоступен. Сохраните файл как XLSX или скачайте оригинал.');
  const entries = await readZipEntries(arrayBuffer);
  if (extension === 'docx') return parseDocx(entries);
  if (['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm'].includes(extension)) return parsePptx(entries);
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
          const contentType = response.headers?.['content-type'] || '';
          const blob = new Blob([response.data], { type: getPreviewMime(previewType, file.name, contentType) });
          objectUrl = URL.createObjectURL(blob);
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

function SpreadsheetPreview({ office, theme }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const activeSheet = office.sheets[Math.min(activeSheetIndex, office.sheets.length - 1)];
  if (!activeSheet) return <div style={{ color: theme.palette.text.secondary }}>В книге нет данных для предпросмотра.</div>;

  return (
    <div style={{ width: '100%', height: '70vh', minHeight: 360, display: 'flex', flexDirection: 'column', background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: `1px solid ${theme.palette.divider}`, background: theme.ep.subtle }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeSheet.name}</strong>
          <span style={{ color: theme.palette.text.secondary, fontSize: 12 }}>{activeSheet.totalRows} строк, {activeSheet.totalColumns} колонок</span>
        </div>
      </div>
      {office.sheets.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper, overflowX: 'auto' }}>
          {office.sheets.map((sheet, index) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => setActiveSheetIndex(index)}
              style={{
                border: `1px solid ${index === activeSheetIndex ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 6,
                background: index === activeSheetIndex ? alpha(theme.palette.primary.main, 0.14) : theme.palette.background.paper,
                color: index === activeSheetIndex ? theme.palette.primary.main : theme.palette.text.primary,
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
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%', background: theme.palette.background.paper, fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 48 }} />
            {activeSheet.columns.map((column, index) => <col key={`width-${index}`} style={{ width: column.hidden ? 0 : column.width }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, width: 48, minWidth: 48, background: theme.ep.subtle, borderRight: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}` }} />
              {activeSheet.columns.map((column, index) => (
                <th key={`col-${index}`} style={{ position: 'sticky', top: 0, zIndex: 2, width: column.hidden ? 0 : column.width, minWidth: column.hidden ? 0 : 44, background: theme.ep.subtle, borderRight: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary, fontWeight: 700, padding: column.hidden ? 0 : '7px 10px', textAlign: 'center', overflow: 'hidden' }}>{column.hidden ? '' : columnNameFromIndex(index)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSheet.rows.map((row, rowIndex) => activeSheet.rowMeta[rowIndex]?.hidden ? null : (
              <tr key={`row-${rowIndex}`} style={{ height: activeSheet.rowMeta[rowIndex]?.height }}>
                <th style={{ position: 'sticky', left: 0, zIndex: 1, width: 48, minWidth: 48, background: theme.ep.subtle, borderRight: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary, fontWeight: 700, padding: activeSheet.rowMeta[rowIndex]?.hidden ? 0 : '7px 8px', textAlign: 'right', overflow: 'hidden' }}>{activeSheet.rowMeta[rowIndex]?.hidden ? '' : rowIndex + 1}</th>
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
                        borderRight: `1px solid ${theme.palette.divider}`,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        color: theme.palette.text.primary,
                        backgroundColor: theme.palette.background.paper,
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

function paragraphAlign(value) {
  if (value === 'ctr') return 'center';
  if (value === 'r') return 'right';
  if (value === 'just') return 'justify';
  return 'left';
}

function SlideCanvas({ slide, slideSize, theme, thumbnail = false }) {
  const slideTextColor = slide.textColor || readableTextColor(slide.background);
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${slideSize.width} / ${slideSize.height}`,
        background: slide.background || '#fff',
        color: slideTextColor,
        overflow: 'hidden',
        boxShadow: thumbnail ? 'none' : '0 18px 48px rgba(0,0,0,0.22)',
      }}
    >
      {slide.objects.map((object, index) => {
        const commonStyle = {
          position: 'absolute',
          left: object.box.left,
          top: object.box.top,
          width: object.box.width,
          height: object.box.height,
          zIndex: index + 1,
        };
        if (object.kind === 'image') {
          return <img key={object.id} src={object.src} alt="" style={{ ...commonStyle, objectFit: 'fill' }} />;
        }
        return (
          <div
            key={object.id}
            style={{
              ...commonStyle,
              ...object.style,
              boxSizing: 'border-box',
              padding: thumbnail ? 2 : '0.45%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {object.paragraphs.map((paragraph, paragraphIndex) => (
              <p
                key={`${object.id}-p-${paragraphIndex}`}
                style={{
                  margin: thumbnail ? '0 0 1px' : '0 0 0.35em',
                  lineHeight: 1.12,
                  textAlign: paragraphAlign(paragraph.align),
                  color: slideTextColor,
                }}
              >
                {paragraph.runs.map((run, runIndex) => (
                  <span
                    key={`${object.id}-p-${paragraphIndex}-r-${runIndex}`}
                    style={{
                      color: run.style.color || readableTextColor(object.fillColor || slide.background),
                      fontFamily: run.style.fontFamily || 'Arial, sans-serif',
                      fontSize: thumbnail ? undefined : run.style.fontSize || '18pt',
                      fontWeight: run.style.fontWeight,
                      fontStyle: run.style.fontStyle,
                      textDecoration: run.style.textDecoration,
                    }}
                  >
                    {run.text}
                  </span>
                ))}
              </p>
            ))}
          </div>
        );
      })}
      {!slide.objects.length && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '8%', color: '#64748b', fontFamily: 'Arial, sans-serif', fontSize: thumbnail ? 8 : 22, textAlign: 'center' }}>
          {slide.plainText || 'Пустой слайд'}
        </div>
      )}
      {thumbnail && <div style={{ position: 'absolute', inset: 0, border: `1px solid ${theme.palette.divider}`, pointerEvents: 'none' }} />}
    </div>
  );
}

function PresentationPreview({ office, theme }) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = office.slides[Math.min(activeSlideIndex, office.slides.length - 1)];
  const slideAspect = office.slideSize.width / office.slideSize.height;
  if (!activeSlide) return <div style={{ color: theme.palette.text.secondary }}>В презентации нет слайдов для предпросмотра.</div>;

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: 'clamp(110px, 14vw, 170px) minmax(0, 1fr)', background: theme.palette.background.paper, overflow: 'hidden' }}>
      <aside style={{ overflowY: 'auto', background: theme.palette.mode === 'dark' ? '#101317' : '#f3f4f6', borderRight: `1px solid ${theme.palette.divider}`, padding: 10 }}>
        {office.slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setActiveSlideIndex(index)}
            title={slide.plainText || slide.title}
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '20px minmax(0, 1fr)',
              gap: 6,
              alignItems: 'start',
              border: `2px solid ${index === activeSlideIndex ? theme.palette.primary.main : 'transparent'}`,
              borderRadius: 6,
              background: index === activeSlideIndex ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
              color: theme.palette.text.primary,
              cursor: 'pointer',
              marginBottom: 10,
              padding: 5,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: theme.palette.text.secondary, lineHeight: 1.3 }}>{index + 1}</span>
            <span style={{ minWidth: 0 }}>
              <SlideCanvas slide={slide} slideSize={office.slideSize} theme={theme} thumbnail />
            </span>
          </button>
        ))}
      </aside>
      <main style={{ minWidth: 0, minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', background: theme.palette.mode === 'dark' ? '#20242b' : '#e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper }}>
          <strong style={{ color: theme.palette.text.primary }}>{activeSlide.title}</strong>
          <span style={{ color: theme.palette.text.secondary, fontSize: 12 }}>{activeSlideIndex + 1} из {office.slides.length}</span>
        </div>
        <div style={{ minWidth: 0, minHeight: 0, overflow: 'auto', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ width: `min(100%, calc((96vh - 180px) * ${slideAspect}))`, minWidth: 280, maxWidth: '1240px' }}>
            <SlideCanvas slide={activeSlide} slideSize={office.slideSize} theme={theme} />
          </div>
        </div>
      </main>
    </div>
  );
}

function OfficePreview({ office, theme }) {
  if (!office) return null;
  if (office.type === 'spreadsheet') return <SpreadsheetPreview office={office} theme={theme} />;
  if (office.type === 'presentation') return <PresentationPreview office={office} theme={theme} />;
  return <div style={{ width: '100%', maxHeight: '70vh', overflow: 'auto', background: theme.palette.background.paper, color: theme.palette.text.primary, padding: 18, borderRadius: 8 }}>{office.paragraphs.map((paragraph, index) => <p key={`paragraph-${index}`} style={{ margin: '0 0 10px', lineHeight: 1.55 }}>{paragraph}</p>)}</div>;
}

function PreviewContent({ file, state, theme }) {
  const type = getPreviewType(file.name);
  const mediaStyle = { maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 };
  if (state.loading) return <div style={{ color: theme.palette.text.secondary }}>Загрузка данных...</div>;
  if (state.error) return <div style={{ color: theme.palette.error.main, fontWeight: 600 }}>{state.error}</div>;
  if (type === 'image') return <img src={state.previewUrl} alt="Preview" style={mediaStyle} />;
  if (type === 'video') return <video src={state.previewUrl} style={{ ...mediaStyle, width: '100%', background: '#000' }} controls />;
  if (type === 'audio') return <audio src={state.previewUrl} controls style={{ width: '100%' }} />;
  if (type === 'pdf') return <iframe src={`${state.previewUrl}#toolbar=1&navpanes=0`} title={file.name} style={{ width: '100%', height: '70vh', border: `1px solid ${theme.palette.divider}`, borderRadius: 8, background: '#fff' }} />;
  if (type === 'office') return <OfficePreview office={state.office} theme={theme} />;
  return <pre style={{ width: '100%', maxHeight: '70vh', overflow: 'auto', background: theme.palette.background.paper, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}`, padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{state.content}</pre>;
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
  const theme = useTheme();
  const state = usePreview(file);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [hoveredButton, setHoveredButton] = useState('');
  const isPresentation = state.office?.type === 'presentation';
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const closeButtonCurrentStyle = {
    ...closeButtonStyle,
    background: alpha(theme.palette.error.main, 0.12),
    borderColor: alpha(theme.palette.error.main, 0.32),
    color: theme.palette.error.main,
    ...(hoveredButton === 'close' ? { background: alpha(theme.palette.error.main, 0.18), borderColor: alpha(theme.palette.error.main, 0.46), boxShadow: `0 8px 20px ${alpha(theme.palette.error.main, 0.16)}`, transform: 'translateY(-1px)' } : {}),
  };
  const downloadButtonCurrentStyle = {
    ...downloadButtonStyle,
    background: alpha(theme.palette.success.main, 0.12),
    borderColor: alpha(theme.palette.success.main, 0.32),
    color: theme.palette.success.main,
    ...(hoveredButton === 'download' && !downloading ? { background: alpha(theme.palette.success.main, 0.18), borderColor: alpha(theme.palette.success.main, 0.46), boxShadow: `0 8px 20px ${alpha(theme.palette.success.main, 0.16)}`, transform: 'translateY(-1px)' } : {}),
    ...(downloading ? { cursor: 'not-allowed', opacity: 0.68, transform: 'none' } : {}),
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha('#000', theme.palette.mode === 'dark' ? 0.78 : 0.64), zIndex: 2000, padding: isPresentation ? 10 : 16 }} onClick={onClose}>
      <div style={{ background: theme.palette.background.paper, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}`, boxShadow: theme.ep.menuShadow, borderRadius: 12, width: isPresentation ? 'min(98vw, 1480px)' : 'min(95vw, 920px)', height: isPresentation ? '96vh' : undefined, maxHeight: isPresentation ? '96vh' : '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'center', padding: 16, borderBottom: `1px solid ${theme.palette.divider}` }}><strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</strong></div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: theme.ep.subtle, padding: isPresentation ? 0 : 24, display: 'flex', alignItems: isPresentation ? 'stretch' : 'center', justifyContent: 'center' }}><PreviewContent file={file} state={{ ...state, error: state.error || downloadError }} theme={theme} /></div>
        <div style={{ padding: 14, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', gap: 12 }}><button type="button" style={downloadButtonCurrentStyle} onMouseEnter={() => setHoveredButton('download')} onMouseLeave={() => setHoveredButton('')} onClick={() => downloadFile(file, setDownloadError, setDownloading)} disabled={downloading}>{downloading ? 'Скачивание...' : 'Скачать'}</button><button type="button" style={closeButtonCurrentStyle} onMouseEnter={() => setHoveredButton('close')} onMouseLeave={() => setHoveredButton('')} onClick={onClose}>Закрыть</button></div>
      </div>
    </div>
  );
}

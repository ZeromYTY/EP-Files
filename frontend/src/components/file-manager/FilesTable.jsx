import { Paper } from '@mui/material';
import FileRow from './FileRow';
import { Description, Folder } from '@mui/icons-material';

function FileVisual({ file, size = 32 }) {
  if (file.type === 'folder') return <Folder sx={{ fontSize: size, color: '#FF9800' }} />;
  return <Description sx={{ fontSize: size, color: '#2563EB' }} />;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${parseFloat((bytes / (1024 ** index)).toFixed(1))} ${sizes[index]}`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FilesTable({ files = [], ...handlers }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden', backgroundColor: '#fff' }}>
      {files.map((file) => (
        <FileRow
          key={`${file.type || 'file'}-${file.id}`}
          file={file}
          getFileIcon={(item, size) => <FileVisual file={item} size={size} />}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
          {...handlers}
        />
      ))}
    </Paper>
  );
}

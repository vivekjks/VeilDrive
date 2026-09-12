import { File, FileArchive, FileCode, FileImage, FilePdf, FileText, Folder } from '@phosphor-icons/react';
import type { DriveItem } from '../types';

export const FileIcon = ({ item, size = 22 }: { item: DriveItem; size?: number }) => {
  if (item.kind === 'folder') return <Folder size={size} weight="light" />;
  if (item.mimeType.includes('pdf')) return <FilePdf size={size} weight="light" />;
  if (item.mimeType.includes('image')) return <FileImage size={size} weight="light" />;
  if (item.mimeType.includes('zip')) return <FileArchive size={size} weight="light" />;
  if (item.mimeType.includes('markdown') || item.mimeType.includes('json')) return <FileCode size={size} weight="light" />;
  if (item.mimeType.includes('text')) return <FileText size={size} weight="light" />;
  return <File size={size} weight="light" />;
};

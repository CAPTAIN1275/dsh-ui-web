/**
 * 16x16 file/folder icons for the tree — a small built-in set (folder
 * open/closed, file variants by kind) using the token colors, so both themes
 * stay consistent without pulling in a vscode-icons package.
 * @module dsh-aionui-panel/client/components/FileIcon
 */

import type { JSX } from 'react'
import { detectContentType } from '../fileType.ts'
import {
  FileCodeIcon, FileIcon, FileImageIcon, FileTextIcon, FolderIcon, FolderOpenIcon,
} from './icons.tsx'

/** The icon for one tree entry (16x16, currentColor). */
export function FileTypeIcon({
  name,
  isDir,
  expanded,
  className,
}: {
  name: string
  isDir: boolean
  expanded: boolean
  className?: string
}): JSX.Element {
  if (isDir) {
    return expanded
      ? <FolderOpenIcon size={16} className={className} />
      : <FolderIcon size={16} className={className} />
  }
  const type = detectContentType(name)
  switch (type) {
    case 'image':
      return <FileImageIcon size={16} className={className} />
    case 'markdown':
    case 'text':
      return <FileTextIcon size={16} className={className} />
    case 'code':
    case 'diff':
    case 'csv':
    case 'html':
      return <FileCodeIcon size={16} className={className} />
    default:
      return <FileIcon size={16} className={className} />
  }
}

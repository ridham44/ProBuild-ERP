'use client';

import { FileText, Paperclip, UploadCloud, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type FileRule = {
  /** Allowed MIME types, e.g. application/pdf. */
  accept: string[];
  maxSizeBytes: number;
};

export type FileProblem = { fileName: string; reason: string };

export type FileValidation = { accepted: File[]; problems: FileProblem[] };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pure validation so it can be reused and tested without the UI. */
export function validateFiles(files: File[], rule: FileRule): FileValidation {
  const accepted: File[] = [];
  const problems: FileProblem[] = [];
  for (const file of files) {
    if (!rule.accept.includes(file.type)) {
      problems.push({ fileName: file.name, reason: 'This file type is not allowed' });
    } else if (file.size > rule.maxSizeBytes) {
      problems.push({
        fileName: file.name,
        reason: `Larger than ${formatBytes(rule.maxSizeBytes)}`,
      });
    } else if (file.size === 0) {
      problems.push({ fileName: file.name, reason: 'The file is empty' });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, problems };
}

export type FileUploaderProps = {
  rule: FileRule;
  /** Human description of allowed types, e.g. "PDF, JPG or PNG". */
  acceptLabel: string;
  multiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
};

/** Selection and validation only. Wiring to pre-signed uploads happens when storage exists. */
export function FileUploader({
  rule,
  acceptLabel,
  multiple = false,
  files,
  onFilesChange,
  disabled,
  className,
}: FileUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [problems, setProblems] = React.useState<FileProblem[]>([]);

  function receive(list: FileList | null): void {
    if (!list || list.length === 0) return;
    const result = validateFiles(Array.from(list), rule);
    setProblems(result.problems);
    onFilesChange(multiple ? [...files, ...result.accepted] : result.accepted.slice(0, 1));
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) receive(event.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-muted/40 px-4 py-6 text-center',
          dragging && 'border-primary bg-primary-subtle',
          disabled && 'opacity-60',
        )}
      >
        <UploadCloud className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm">
          Drag {multiple ? 'files' : 'a file'} here or{' '}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="font-medium text-primary hover:underline disabled:no-underline"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          {acceptLabel}, up to {formatBytes(rule.maxSizeBytes)} each
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          multiple={multiple}
          accept={rule.accept.join(',')}
          disabled={disabled}
          onChange={(event) => {
            receive(event.target.files);
            event.target.value = '';
          }}
          aria-label="Choose files"
        />
      </div>
      {problems.length > 0 ? (
        <ul className="space-y-1" role="alert">
          {problems.map((problem) => (
            <li key={problem.fileName} className="text-xs text-danger">
              <span className="font-medium">{problem.fileName}</span>: {problem.reason}
            </li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <ul className="divide-y divide-border rounded border border-border">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 px-2.5 py-1.5 text-sm"
            >
              {file.type.startsWith('image/') ? (
                <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
              ) : (
                <FileText className="size-3.5 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => onFilesChange(files.filter((_, position) => position !== index))}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

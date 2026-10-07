'use client';

import type { Table } from '@tanstack/react-table';
import { Columns3 } from 'lucide-react';
import { presentation } from './column-meta';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function columnLabel(header: unknown, id: string, metaLabel: string | undefined): string {
  if (metaLabel) return metaLabel;
  return typeof header === 'string' ? header : id;
}

export function ColumnVisibilityMenu<T>({ table }: { table: Table<T> }) {
  const hideable = table.getAllLeafColumns().filter((column) => column.getCanHide());
  if (hideable.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          <Columns3 className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Columns</span>
          <span className="sr-only sm:hidden">Columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {hideable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {columnLabel(
              column.columnDef.header,
              column.id,
              presentation(column.columnDef.meta).label,
            )}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

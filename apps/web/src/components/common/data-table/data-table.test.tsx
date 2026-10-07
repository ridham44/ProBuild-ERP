import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { DataColumn } from './column-meta';
import { DataTable, type DataTableProps } from './data-table';

type Row = { id: string; code: string; name: string; amount: number };

const rows: Row[] = [
  { id: '1', code: 'PO-3', name: 'Cement supply', amount: 300 },
  { id: '2', code: 'PO-1', name: 'Rebar', amount: 100 },
  { id: '3', code: 'PO-2', name: 'Gravel', amount: 200 },
];

const columns: DataColumn<Row>[] = [
  {
    id: 'code',
    header: 'Code',
    accessorFn: (row) => row.code,
    enableSorting: true,
    cell: ({ row }) => row.original.code,
  },
  {
    id: 'name',
    header: 'Name',
    accessorFn: (row) => row.name,
    cell: ({ row }) => row.original.name,
  },
  {
    id: 'amount',
    header: 'Amount',
    accessorFn: (row) => row.amount,
    enableSorting: true,
    meta: { numeric: true },
    cell: ({ row }) => row.original.amount.toFixed(2),
  },
];

function setup(props: Partial<DataTableProps<Row>> = {}) {
  return render(
    <TooltipProvider>
      <DataTable<Row>
        caption="Orders"
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        emptyState={<p>Nothing here yet</p>}
        getSearchText={(row) => `${row.code} ${row.name}`}
        {...props}
      />
    </TooltipProvider>,
  );
}

function bodyCodes(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('DataTable', () => {
  it('renders headers and rows', () => {
    setup();
    expect(screen.getByRole('table', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /code/i })).toBeInTheDocument();
    expect(bodyCodes()).toEqual(['PO-3', 'PO-1', 'PO-2']);
  });

  it('sorts a column ascending then descending and exposes aria-sort', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /code/i }));
    expect(bodyCodes()).toEqual(['PO-1', 'PO-2', 'PO-3']);
    expect(screen.getByRole('columnheader', { name: /code/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: /code/i }));
    expect(bodyCodes()).toEqual(['PO-3', 'PO-2', 'PO-1']);
    expect(screen.getByRole('columnheader', { name: /code/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('filters loaded rows with the search box', async () => {
    const user = userEvent.setup();
    setup();
    const search = screen.getByRole('searchbox', { name: /filter rows/i });
    await user.type(search, 'rebar');
    expect(bodyCodes()).toEqual(['PO-1']);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('No rows match your filter')).toBeInTheDocument();
  });

  it('right-aligns numeric columns with tabular numerals', () => {
    setup();
    const cell = screen.getByText('300.00').closest('td');
    expect(cell).toHaveClass('text-right');
    expect(cell).toHaveClass('num');
    expect(screen.getByRole('columnheader', { name: /amount/i })).toHaveClass('text-right');
  });

  it('hides a column from the column menu', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /columns/i }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Name' }));
    expect(screen.queryByRole('columnheader', { name: /name/i })).not.toBeInTheDocument();
  });

  it('selects rows and reports the selection', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    setup({ selectable: true, onSelectionChange });
    const checkboxes = screen.getAllByRole('checkbox', { name: 'Select row' });
    await user.click(checkboxes[1] as HTMLElement);
    expect(onSelectionChange).toHaveBeenLastCalledWith([rows[1]]);
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(rows);
  });

  it('moves focus between rows with the arrow keys and activates with Enter', async () => {
    const user = userEvent.setup();
    const onRowActivate = vi.fn();
    setup({ onRowActivate });
    const bodyRows = screen.getAllByRole('row').slice(1);
    bodyRows[0]?.focus();
    await user.keyboard('{ArrowDown}');
    expect(bodyRows[1]).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRowActivate).toHaveBeenCalledWith(rows[1]);
  });

  it('shows the empty state when there is no data', () => {
    setup({ data: [] });
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('marks the table busy and hides the empty state while loading', () => {
    setup({ loading: true, data: [] });
    expect(screen.getByRole('table', { name: 'Orders' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    setup({ error: new Error('offline'), onRetry });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('wires cursor pagination controls', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    setup({
      pagination: { count: 3, hasPrevious: false, hasNext: true, onPrevious: vi.fn(), onNext },
    });
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalled();
  });
});

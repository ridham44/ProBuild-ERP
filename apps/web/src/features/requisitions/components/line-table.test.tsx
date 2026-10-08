import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { blankLine, validateRequisition, type LineDraft } from '../model';
import { LineTable } from './line-table';

vi.mock('@/features/items/api/hooks', () => {
  const rows = [
    { id: 'i-cem', sku: 'CEM-40', name: 'Portland Cement 40kg', baseUnit: 'bag', lastPurchaseCost: '280', standardCost: '285' },
    { id: 'i-rbr', sku: 'RBR-16', name: 'Deformed Bar 16mm', baseUnit: 'pc', lastPurchaseCost: '0', standardCost: '742' },
  ];
  return {
    searchItemOptions: async (search: string) =>
      rows
        .filter((row) => `${row.sku} ${row.name}`.toLowerCase().includes(search.toLowerCase()))
        .map((row) => ({ value: row.id, label: `${row.sku} · ${row.name}`, description: row.baseUnit })),
    getCachedItem: (id: string) => rows.find((row) => row.id === id),
  };
});

function Harness({ initial, showErrors = false }: { initial: LineDraft[]; showErrors?: boolean }) {
  const [lines, setLines] = React.useState(initial);
  const errors = validateRequisition(
    { projectId: 'p', warehouseId: '', priority: 'NORMAL', requiredDate: '', purpose: '', remarks: '' },
    lines,
  ).lines;
  return (
    <LineTable
      lines={lines}
      errors={errors}
      showErrors={showErrors}
      dimensions={{ wbs: [], costCodes: [], boq: [] }}
      onChange={setLines}
    />
  );
}

function renderTable(initial: LineDraft[], showErrors = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} showErrors={showErrors} />
    </QueryClientProvider>,
  );
}

const cement = () =>
  blankLine({ itemId: 'i-cem', sku: 'CEM-40', itemName: 'Portland Cement 40kg', baseUnit: 'bag', unit: 'bag', qty: '500', defaultUnitCost: '280' });

const rows = () => screen.getAllByRole('row').filter((row) => row.hasAttribute('data-line'));

describe('Requisition line table', () => {
  it('adds a line from the Add line button', async () => {
    const user = userEvent.setup();
    renderTable([cement()]);
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    expect(rows()).toHaveLength(2);
  });

  it('duplicates a line with its item and quantity, and removes lines', async () => {
    const user = userEvent.setup();
    renderTable([cement()]);
    await user.click(screen.getByRole('button', { name: 'Duplicate line 1' }));
    expect(rows()).toHaveLength(2);
    expect(screen.getByLabelText('Quantity, line 2')).toHaveValue('500');
    expect(screen.getByLabelText('Unit, line 2')).toHaveValue('bag');
    await user.click(screen.getByRole('button', { name: 'Remove line 1' }));
    expect(rows()).toHaveLength(1);
  });

  it('shows the amount from quantity times the default cost, and from a typed estimate', async () => {
    const user = userEvent.setup();
    renderTable([cement()]);
    expect(within(rows()[0] as HTMLElement).getByText('₱140,000.00')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Estimated unit cost, line 1'), '300');
    expect(within(rows()[0] as HTMLElement).getByText('₱150,000.00')).toBeInTheDocument();
  });

  it('Enter on the last row adds a line; Enter and arrows move down and up a column', async () => {
    const user = userEvent.setup();
    renderTable([cement(), cement()]);
    await user.click(screen.getByLabelText('Quantity, line 1'));
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Quantity, line 2')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByLabelText('Quantity, line 1')).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(rows()).toHaveLength(3);
    await waitFor(() => expect(document.getElementById('line-2-item')).toHaveFocus());
  });

  it('picks an item by search and defaults the unit to its base unit', async () => {
    const user = userEvent.setup();
    renderTable([blankLine()]);
    const combo = screen.getByRole('combobox');
    await user.click(combo);
    await user.type(combo, 'RBR');
    await user.click(await screen.findByRole('option', { name: /RBR-16/ }));
    expect(screen.getByLabelText('Unit, line 1')).toHaveValue('pc');
    await waitFor(() => expect(screen.getByLabelText('Quantity, line 1')).toHaveFocus());
  });

  it('marks invalid fields inline once errors are shown', () => {
    renderTable([blankLine({ qty: '0' })], true);
    expect(screen.getByText('Choose an item')).toBeInTheDocument();
    expect(screen.getByText('Must be above 0')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity, line 1')).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps errors hidden until the user tries to save', () => {
    renderTable([blankLine()], false);
    expect(screen.queryByText('Choose an item')).not.toBeInTheDocument();
  });
});

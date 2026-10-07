import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster, toast } from '@/components/ui/toast';
import { ApprovalTimeline } from './approval-timeline';
import { Breadcrumbs } from './breadcrumbs';
import { Combobox, type ComboOption } from './combobox';
import { ConfirmDialog } from './confirm-dialog';
import { ErrorState } from './error-state';
import { FormField } from './form-field';
import { Stat } from './stat';

const options: ComboOption[] = [
  { value: 'a', label: 'Cement 40kg' },
  { value: 'b', label: 'Rebar 16mm' },
  { value: 'c', label: 'Gravel 3/4' },
];

function ComboHarness({ onChange }: { onChange: (value: string | null) => void }) {
  const [value, setValue] = React.useState<string | null>(null);
  return (
    <Combobox
      aria-describedby={undefined}
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('Combobox', () => {
  it('filters options as you type and selects with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ComboHarness onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'reb');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('combobox')).toHaveValue('Rebar 16mm');
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    render(<ComboHarness onChange={vi.fn()} />);
    await user.type(screen.getByRole('combobox'), 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('confirms and cancels, and locks while loading', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ConfirmDialog open onOpenChange={onOpenChange} title="Deactivate branch?" description="It stays on old records." confirmLabel="Deactivate" onConfirm={onConfirm} />,
    );
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(<ConfirmDialog open onOpenChange={onOpenChange} title="Deactivate branch?" description="It stays on old records." confirmLabel="Deactivate" loading onConfirm={onConfirm} />);
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

describe('Toaster', () => {
  it('announces success and error toasts', () => {
    render(<Toaster />);
    act(() => {
      toast.success('Saved', 'Company profile updated');
      toast.error('Could not save');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  });
});

describe('ErrorState variants', () => {
  it.each([
    ['forbidden', /do not have access/i],
    ['not-found', /could not find/i],
    ['server', /server hit a problem/i],
    ['session-expired', /session has ended/i],
    ['network', /cannot reach the server/i],
  ] as const)('renders the %s variant', (kind, title) => {
    render(<ErrorState kind={kind} />);
    expect(screen.getByRole('alert')).toHaveTextContent(title);
  });

  it('offers sign in for an expired session', () => {
    render(<ErrorState kind="session-expired" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});

describe('ApprovalTimeline', () => {
  it('shows approver, decision, timestamp in Manila time and comment', () => {
    render(
      <ApprovalTimeline
        steps={[
          { order: 1, roleName: 'Project Manager', state: 'approved', approver: 'Paolo Villanueva', decidedAt: '2026-10-07T04:05:00Z', comment: 'Within budget' },
          { order: 2, roleName: 'Finance', state: 'current' },
        ]}
      />,
    );
    expect(screen.getByText('Paolo Villanueva')).toBeInTheDocument();
    expect(screen.getByText('07 Oct 2026, 12:05 PM')).toBeInTheDocument();
    expect(screen.getByText('Within budget')).toBeInTheDocument();
    expect(screen.getByText('Awaiting decision')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Finance');
  });
});

describe('FormField', () => {
  it('links label, hint and error to the control', () => {
    render(<FormField label="Email" error="Enter a valid email">{(control) => <input {...control} />}</FormField>);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email');
  });
});

describe('Tabs and RadioGroup', () => {
  it('switches tab panels with the keyboard', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First panel</TabsContent>
        <TabsContent value="two">Second panel</TabsContent>
      </Tabs>,
    );
    await user.click(screen.getByRole('tab', { name: 'One' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Second panel')).toBeInTheDocument();
  });

  it('selects a radio option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup onValueChange={onValueChange} aria-label="VAT">
        <RadioGroupItem value="VAT" aria-label="VAT registered" />
        <RadioGroupItem value="NON_VAT" aria-label="Non-VAT" />
      </RadioGroup>,
    );
    await user.click(screen.getByRole('radio', { name: 'Non-VAT' }));
    expect(onValueChange).toHaveBeenCalledWith('NON_VAT');
  });
});

describe('Breadcrumbs and Stat', () => {
  it('marks the current page and links the earlier crumbs', () => {
    render(<Breadcrumbs items={[{ label: 'Administration', href: '/admin' }, { label: 'Users' }]} />);
    expect(screen.getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin');
    expect(screen.getByText('Users')).toHaveAttribute('aria-current', 'page');
  });

  it('renders a KPI with tabular figures and no invented trend', () => {
    render(<Stat label="Waiting on you" value="3" hint="approval requests" href="/approvals" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/approvals');
    expect(screen.getByText('3')).toHaveClass('num');
  });
});

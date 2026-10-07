import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STATUS_DEFINITIONS, StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('covers the full document status vocabulary', () => {
    const labels = Object.values(STATUS_DEFINITIONS).map((definition) => definition.label);
    for (const label of [
      'Draft',
      'Pending Approval',
      'Approved',
      'Rejected',
      'Partially Received',
      'Received',
      'Posted',
      'Paid',
      'Cancelled',
      'Closed',
      'Overdue',
    ]) {
      expect(labels).toContain(label);
    }
  });

  it('maps API enum values onto the shared labels', () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('accepts spaced input and the US spelling of cancelled', () => {
    render(
      <>
        <StatusBadge status="partially received" />
        <StatusBadge status="CANCELED" />
      </>,
    );
    expect(screen.getByText('Partially Received')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('uses distinct semantic tones for pending, approved, rejected and overdue', () => {
    render(
      <>
        <StatusBadge status="PENDING_APPROVAL" />
        <StatusBadge status="APPROVED" />
        <StatusBadge status="REJECTED" />
        <StatusBadge status="OVERDUE" />
      </>,
    );
    expect(screen.getByText('Pending Approval').className).toContain('text-pending');
    expect(screen.getByText('Approved').className).toContain('text-approved');
    expect(screen.getByText('Rejected').className).toContain('text-rejected');
    expect(screen.getByText('Overdue').className).toContain('text-overdue');
  });

  it('falls back to a neutral label for unknown statuses', () => {
    render(<StatusBadge status="IN_REVIEW" />);
    expect(screen.getByText('In Review').className).toContain('text-muted-foreground');
  });
});

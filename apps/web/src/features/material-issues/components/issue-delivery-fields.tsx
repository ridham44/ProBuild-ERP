'use client';

import { TextAreaField, TextField } from '@/components/common/form-controls';
import { Panel } from '@/components/common/panel';

export type IssueDelivery = {
  issueDate: string;
  receivedBy: string;
  vehicle: string;
  deliveryRef: string;
  remarks: string;
};

export function blankDelivery(issueDate: string): IssueDelivery {
  return { issueDate, receivedBy: '', vehicle: '', deliveryRef: '', remarks: '' };
}

/** Delivery details shared by both ways of raising an issue. */
export function deliveryPayload(delivery: IssueDelivery): {
  issueDate?: string;
  receivedBy?: string;
  vehicle?: string;
  deliveryRef?: string;
  remarks?: string;
} {
  const text = (value: string): string | undefined => (value.trim() ? value.trim() : undefined);
  return {
    ...(delivery.issueDate ? { issueDate: delivery.issueDate } : {}),
    ...(text(delivery.receivedBy) ? { receivedBy: text(delivery.receivedBy) } : {}),
    ...(text(delivery.vehicle) ? { vehicle: text(delivery.vehicle) } : {}),
    ...(text(delivery.deliveryRef) ? { deliveryRef: text(delivery.deliveryRef) } : {}),
    ...(text(delivery.remarks) ? { remarks: text(delivery.remarks) } : {}),
  };
}

export function IssueDeliveryFields({
  value,
  onChange,
  remarksLabel,
  remarksRequired,
  remarksError,
}: {
  value: IssueDelivery;
  onChange: (change: Partial<IssueDelivery>) => void;
  remarksLabel: string;
  remarksRequired: boolean;
  remarksError?: string | undefined;
}) {
  return (
    <Panel title="Delivery">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Issue date" type="date" value={value.issueDate} onChange={(event) => onChange({ issueDate: event.target.value })} />
        <TextField label="Received by" maxLength={120} value={value.receivedBy} onChange={(event) => onChange({ receivedBy: event.target.value })} />
        <TextField label="Vehicle" maxLength={60} value={value.vehicle} onChange={(event) => onChange({ vehicle: event.target.value })} />
        <TextField label="Delivery reference" maxLength={80} value={value.deliveryRef} onChange={(event) => onChange({ deliveryRef: event.target.value })} />
        <TextAreaField
          label={remarksLabel}
          wide
          className="sm:col-span-2 lg:col-span-4"
          maxLength={1000}
          required={remarksRequired}
          error={remarksError}
          value={value.remarks}
          onChange={(event) => onChange({ remarks: event.target.value })}
        />
      </div>
    </Panel>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { QueryErrorState } from '@/components/common/error-state';
import { FormField } from '@/components/common/form-field';
import { FormSection } from '@/components/common/form-section';
import { PageHeader } from '@/components/common/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { useCan } from '@/features/auth/components/current-user';
import type { CompanyDto, CompanyUpdate } from '@/lib/api/contract';
import { applyServerErrors } from '@/lib/forms';
import { formatDateTime } from '@/lib/format';
import { useCompany, useUpdateCompany } from '../api/hooks';
import { companyFormSchema, MONTH_NAMES, VAT_OPTIONS, type CompanyFormValues } from '../schemas';

const FORM_FIELDS = [
  'legalName',
  'tradeName',
  'tin',
  'secNo',
  'dtiNo',
  'philgepsNo',
  'doleRegistrationNo',
  'businessPermitNo',
  'address',
  'email',
  'phone',
  'vatStatus',
  'fiscalYearStartMonth',
] as const;

/** Blank inputs mean "not provided", which the API stores as null. */
const blankToNull = {
  setValueAs: (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value),
};

function toFormValues(company: CompanyDto): CompanyFormValues {
  return {
    legalName: company.legalName,
    tradeName: company.tradeName,
    tin: company.tin,
    secNo: company.secNo,
    dtiNo: company.dtiNo,
    philgepsNo: company.philgepsNo,
    doleRegistrationNo: company.doleRegistrationNo,
    businessPermitNo: company.businessPermitNo,
    address: company.address,
    email: company.email,
    phone: company.phone,
    vatStatus: company.vatStatus,
    fiscalYearStartMonth: company.fiscalYearStartMonth,
  };
}

function CompanyForm({ company }: { company: CompanyDto }) {
  const canEdit = useCan('organization.company', 'EDIT');
  const update = useUpdateCompany();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    values: toFormValues(company),
  });

  function onSubmit(values: CompanyFormValues): void {
    if (update.isPending) return;
    setFormError(null);
    const body: CompanyUpdate = { ...values };
    update.mutate(body, {
      onSuccess: () => toast.success('Company profile saved'),
      onError: (error) => setFormError(applyServerErrors(error, setError, FORM_FIELDS)),
    });
  }

  const readOnly = !canEdit;
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {readOnly ? (
        <Alert tone="info" className="mb-4">
          You can view the company profile but your role does not allow editing it.
        </Alert>
      ) : null}
      {formError ? (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      ) : null}
      <fieldset disabled={readOnly || update.isPending} className="min-w-0">
        <FormSection
          title="Identity"
          description="How the company appears on documents and reports."
        >
          <FormField label="Legal name" required error={errors.legalName?.message}>
            {(control) => <Input {...control} {...register('legalName')} />}
          </FormField>
          <FormField label="Trade name" error={errors.tradeName?.message}>
            {(control) => <Input {...control} {...register('tradeName', blankToNull)} />}
          </FormField>
          <FormField label="Company code" hint="Assigned at setup and not editable.">
            {(control) => (
              <Input {...control} value={company.code} readOnly disabled className="font-mono" />
            )}
          </FormField>
        </FormSection>

        <FormSection
          title="Registrations"
          description="Government registration numbers printed on invoices and bid documents."
        >
          <FormField label="TIN" error={errors.tin?.message}>
            {(control) => <Input {...control} {...register('tin', blankToNull)} className="num" />}
          </FormField>
          <FormField label="SEC registration no." error={errors.secNo?.message}>
            {(control) => <Input {...control} {...register('secNo', blankToNull)} />}
          </FormField>
          <FormField label="DTI registration no." error={errors.dtiNo?.message}>
            {(control) => <Input {...control} {...register('dtiNo', blankToNull)} />}
          </FormField>
          <FormField label="PhilGEPS no." error={errors.philgepsNo?.message}>
            {(control) => <Input {...control} {...register('philgepsNo', blankToNull)} />}
          </FormField>
          <FormField label="DOLE registration no." error={errors.doleRegistrationNo?.message}>
            {(control) => <Input {...control} {...register('doleRegistrationNo', blankToNull)} />}
          </FormField>
          <FormField label="Business permit no." error={errors.businessPermitNo?.message}>
            {(control) => <Input {...control} {...register('businessPermitNo', blankToNull)} />}
          </FormField>
        </FormSection>

        <FormSection
          title="Contact"
          description="Used for the company header on printed documents."
        >
          <FormField label="Address" wide error={errors.address?.message}>
            {(control) => <Textarea {...control} rows={2} {...register('address', blankToNull)} />}
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            {(control) => <Input {...control} type="email" {...register('email', blankToNull)} />}
          </FormField>
          <FormField label="Phone" error={errors.phone?.message}>
            {(control) => <Input {...control} type="tel" {...register('phone', blankToNull)} />}
          </FormField>
        </FormSection>

        <FormSection
          title="Tax and fiscal year"
          description="Drives VAT treatment and when accounting years begin."
        >
          <FormField label="VAT status" required error={errors.vatStatus?.message}>
            {(control) => (
              <Select {...control} {...register('vatStatus')}>
                {VAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField
            label="Fiscal year starts in"
            required
            error={errors.fiscalYearStartMonth?.message}
          >
            {(control) => (
              <Select {...control} {...register('fiscalYearStartMonth', { valueAsNumber: true })}>
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </FormSection>
      </fieldset>

      {readOnly ? null : (
        <div className="sticky bottom-0 -mx-4 mt-2 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <p className="text-xs text-muted-foreground">
            Last updated {formatDateTime(company.updatedAt)}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => reset(toFormValues(company))}
              disabled={!isDirty || update.isPending}
            >
              Discard changes
            </Button>
            <Button type="submit" variant="primary" loading={update.isPending} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

function CompanyLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading company profile">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompanyView() {
  const company = useCompany();
  return (
    <PermissionGate module="organization.company">
      <PageHeader
        title="Company profile"
        description="Legal identity, registrations and tax settings for this company."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Company' }]}
        meta={
          company.data ? (
            <Badge tone={company.data.active ? 'success' : 'neutral'}>
              {company.data.active ? 'Active' : 'Inactive'}
            </Badge>
          ) : null
        }
      />
      {company.isPending ? (
        <CompanyLoading />
      ) : company.isError ? (
        <QueryErrorState
          error={company.error}
          onRetry={() => void company.refetch()}
          retrying={company.isFetching}
        />
      ) : (
        <CompanyForm company={company.data} />
      )}
    </PermissionGate>
  );
}

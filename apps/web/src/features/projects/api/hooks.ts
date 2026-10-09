'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddProjectMemberInput,
  CreateCostCodeInput,
  CreateEstimateInput,
  CreateWbsNodeInput,
  MoveWbsNodeInput,
  ProjectStatusChangeInput,
  UpdateCostCodeInput,
  UpdateWbsNodeInput,
} from '@probuild/shared';
import type { z } from 'zod';
import type { createBoqItemSchema, updateBoqItemSchema, createContractSchema, createProjectSchema, updateProjectSchema } from '@probuild/shared';
import type { ComboOption } from '@/components/common/combobox';
import { api } from '@/lib/api/browser';
import { apiBody, apiQuery, unwrapAs, unwrapVoid } from '@/lib/api/errors';
import type {
  ActivityItem,
  Budget,
  BudgetDetail,
  BudgetVsActual,
  BoqRow,
  Contract,
  CostCode,
  EstimateApproval,
  EstimateDetail,
  EstimateRow,
  Page,
  ProjectDashboard,
  ProjectDetail,
  ProjectMember,
  ProjectRow,
  WbsRow,
} from '@/lib/api/types';
type CreateProjectInput = z.input<typeof createProjectSchema>;
type UpdateProjectInput = z.input<typeof updateProjectSchema>;
type CreateBoqItemInput = z.input<typeof createBoqItemSchema>;
type UpdateBoqItemInput = z.input<typeof updateBoqItemSchema>;
type CreateContractInput = z.input<typeof createContractSchema>;

import { costCodeKeys, projectKeys, type ProjectFilters } from './keys';

export function useProjects(filters: ProjectFilters, enabled = true) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<ProjectRow>>(await api.GET('/v1/projects', { params: { query: apiQuery(filters) } })),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 60_000,
  });
}

export function useProject(id: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () =>
      unwrapAs<ProjectDetail>(await api.GET('/v1/projects/{id}', { params: { path: { id } } })),
    enabled,
  });
}

export async function searchProjectOptions(search: string): Promise<ComboOption[]> {
  const page = unwrapAs<Page<ProjectRow>>(
    await api.GET('/v1/projects', {
      params: { query: apiQuery({ limit: 20, ...(search ? { search } : {}) }) },
    }),
  );
  return page.items.map((project) => ({
    value: project.id,
    label: project.name,
    description: `${project.code} · ${project.customer.name}`,
  }));
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateProjectInput) =>
      unwrapAs<ProjectRow>(await api.POST('/v1/projects', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProjectInput) =>
      unwrapAs<ProjectRow>(
        await api.PATCH('/v1/projects/{id}', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useChangeProjectStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProjectStatusChangeInput) =>
      unwrapAs<ProjectRow>(
        await api.POST('/v1/projects/{id}/status', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useProjectDashboard(id: string) {
  return useQuery({
    queryKey: projectKeys.dashboard(id),
    queryFn: async () =>
      unwrapAs<ProjectDashboard>(
        await api.GET('/v1/projects/{id}/dashboard', { params: { path: { id } } }),
      ),
  });
}

export function useProjectActivity(id: string) {
  return useQuery({
    queryKey: projectKeys.activity(id),
    queryFn: async () =>
      unwrapAs<ActivityItem[]>(
        await api.GET('/v1/projects/{id}/activity', { params: { path: { id } } }),
      ),
  });
}

export function useProjectMembers(id: string) {
  return useQuery({
    queryKey: projectKeys.members(id),
    queryFn: async () =>
      unwrapAs<ProjectMember[]>(
        await api.GET('/v1/projects/{id}/members', { params: { path: { id } } }),
      ),
  });
}

export function useAddProjectMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AddProjectMemberInput) =>
      unwrapAs<ProjectMember>(
        await api.POST('/v1/projects/{id}/members', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.members(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(id) });
    },
  });
}

export function useUpdateProjectMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string; role: string }) =>
      unwrapAs<ProjectMember>(
        await api.PATCH('/v1/projects/{id}/members/{memberId}', {
          params: { path: { id, memberId: input.memberId } },
          body: apiBody({ role: input.role }),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.members(id) }),
  });
}

export function useRemoveProjectMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) =>
      unwrapVoid(
        await api.DELETE('/v1/projects/{id}/members/{memberId}', {
          params: { path: { id, memberId } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.members(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(id) });
    },
  });
}

export function useProjectContracts(id: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.contracts(id),
    queryFn: async () =>
      unwrapAs<Contract[]>(
        await api.GET('/v1/projects/{id}/contracts', { params: { path: { id } } }),
      ),
    enabled,
  });
}

export function useCreateContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateContractInput) =>
      unwrapAs<Contract>(
        await api.POST('/v1/projects/{id}/contracts', { params: { path: { id } }, body: apiBody(body) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) }),
  });
}

export function useActivateContract(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) =>
      unwrapAs<Contract>(
        await api.POST('/v1/contracts/{id}/activate', { params: { path: { id: contractId } } }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

// ---- WBS ------------------------------------------------------------------------------------------

export function useWbs(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.wbs(projectId),
    queryFn: async () =>
      unwrapAs<WbsRow[]>(
        await api.GET('/v1/projects/{projectId}/wbs', { params: { path: { projectId } } }),
      ),
    enabled,
  });
}

export function useCreateWbsNode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateWbsNodeInput) =>
      unwrapAs<WbsRow>(
        await api.POST('/v1/projects/{projectId}/wbs', {
          params: { path: { projectId } },
          body: apiBody(body),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.wbs(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
    },
  });
}

export function useUpdateWbsNode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: UpdateWbsNodeInput }) =>
      unwrapAs<WbsRow>(
        await api.PATCH('/v1/wbs/{id}', { params: { path: { id: input.id } }, body: apiBody(input.body) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.wbs(projectId) }),
  });
}

export function useMoveWbsNode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: MoveWbsNodeInput }) =>
      unwrapAs<WbsRow>(
        await api.POST('/v1/wbs/{id}/move', { params: { path: { id: input.id } }, body: apiBody(input.body) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.wbs(projectId) }),
  });
}

export function useDeleteWbsNode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(await api.DELETE('/v1/wbs/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.wbs(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
    },
  });
}

// ---- Estimates, BOQ, budget -----------------------------------------------------------------------

export function useEstimates(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.estimates(projectId),
    queryFn: async () =>
      unwrapAs<Page<EstimateRow>>(
        await api.GET('/v1/projects/{projectId}/estimates', {
          params: { path: { projectId }, query: apiQuery({ limit: 50 }) },
        }),
      ),
    enabled,
  });
}

export function useCreateEstimate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateEstimateInput) =>
      unwrapAs<EstimateDetail>(
        await api.POST('/v1/projects/{projectId}/estimates', {
          params: { path: { projectId } },
          body: apiBody(body),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.estimates(projectId) }),
  });
}

export function useAddBoqItem(projectId: string, estimateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBoqItemInput) =>
      unwrapAs<BoqRow>(
        await api.POST('/v1/estimates/{id}/items', {
          params: { path: { id: estimateId } },
          body: apiBody(body),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.boqAll(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.estimates(projectId) });
    },
  });
}

export function useApproveEstimate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (estimateId: string) =>
      unwrapAs<EstimateApproval>(
        await api.POST('/v1/estimates/{id}/approve', { params: { path: { id: estimateId } } }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.estimates(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.budget(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
    },
  });
}

export function useBoq(projectId: string, filters: ProjectFilters, enabled = true) {
  return useQuery({
    queryKey: projectKeys.boq(projectId, filters),
    queryFn: async () =>
      unwrapAs<Page<BoqRow>>(
        await api.GET('/v1/projects/{projectId}/boq', {
          params: { path: { projectId }, query: apiQuery(filters) },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUpdateBoqItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: UpdateBoqItemInput }) =>
      unwrapAs<BoqRow>(
        await api.PATCH('/v1/boq-items/{id}', { params: { path: { id: input.id } }, body: apiBody(input.body) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.boqAll(projectId) }),
  });
}

export function useDeleteBoqItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(await api.DELETE('/v1/boq-items/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.boqAll(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.estimates(projectId) });
    },
  });
}

export function useBudgets(projectId: string, enabled = true) {
  return useQuery({
    queryKey: [...projectKeys.budget(projectId), 'versions'] as const,
    queryFn: async () =>
      unwrapAs<Budget[]>(
        await api.GET('/v1/projects/{projectId}/budgets', { params: { path: { projectId } } }),
      ),
    enabled,
  });
}

export function useCurrentBudget(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.budget(projectId),
    queryFn: async () =>
      unwrapAs<BudgetDetail>(
        await api.GET('/v1/projects/{projectId}/budget', {
          params: { path: { projectId }, query: apiQuery({}) },
        }),
      ),
    enabled,
    retry: false,
  });
}

/** Budget against committed (open purchase orders) and actual cost (posted material issues and other recorded cost), by cost code. */
export function useBudgetVsActual(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.costVsBudget(projectId),
    queryFn: async () =>
      unwrapAs<BudgetVsActual>(
        await api.GET('/v1/projects/{id}/budget-vs-actual', {
          params: { path: { id: projectId }, query: apiQuery({}) },
        }),
      ),
    enabled,
  });
}

// ---- Cost codes -----------------------------------------------------------------------------------

export function useCostCodes(filters: ProjectFilters, enabled = true) {
  return useQuery({
    queryKey: costCodeKeys.list(filters),
    queryFn: async () =>
      unwrapAs<Page<CostCode>>(await api.GET('/v1/cost-codes', { params: { query: apiQuery(filters) } })),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 60_000,
  });
}

export async function searchCostCodeOptions(search: string): Promise<ComboOption[]> {
  const page = unwrapAs<Page<CostCode>>(
    await api.GET('/v1/cost-codes', {
      params: { query: apiQuery({ limit: 30, active: 'true', ...(search ? { search } : {}) }) },
    }),
  );
  return page.items.map((code) => ({ value: code.id, label: `${code.code} ${code.name}` }));
}

export function useCreateCostCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCostCodeInput) =>
      unwrapAs<CostCode>(await api.POST('/v1/cost-codes', { body: apiBody(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: costCodeKeys.lists() }),
  });
}

export function useUpdateCostCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: UpdateCostCodeInput }) =>
      unwrapAs<CostCode>(
        await api.PATCH('/v1/cost-codes/{id}', { params: { path: { id: input.id } }, body: apiBody(input.body) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: costCodeKeys.lists() }),
  });
}

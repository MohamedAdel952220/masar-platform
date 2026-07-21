import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { STALE_TIMES } from '../providers/QueryProvider';
import { queryKeys } from '../queryKeys';
import { tenancy, type TenancyListOptions, type TenancyRelation, type TenancyRow } from '../reads/tenancy';
import {
  identity,
  type IdentityListOptions,
  type IdentityRelation,
  type IdentityRow,
} from '../reads/identity';
import {
  academic,
  type AcademicListOptions,
  type AcademicRelation,
  type AcademicRow,
} from '../reads/academic';
import {
  transport,
  type TransportListOptions,
  type TransportRelation,
  type TransportRow,
} from '../reads/transport';
import { safety, type SafetyListOptions, type SafetyRelation, type SafetyRow } from '../reads/safety';
import { comms, type CommsListOptions, type CommsRelation, type CommsRow } from '../reads/comms';
import {
  approvals,
  type ApprovalsListOptions,
  type ApprovalsRelation,
  type ApprovalsRow,
} from '../reads/approvals';
import { billing, type BillingListOptions, type BillingRelation, type BillingRow } from '../reads/billing';
import { media, type MediaListOptions, type MediaRelation, type MediaRow } from '../reads/media';
import { reports, type ReportsListOptions, type ReportsRelation, type ReportsRow } from '../reads/reports';
import {
  platform,
  type PlatformListOptions,
  type PlatformRelation,
  type PlatformRow,
} from '../reads/platform';
import { jobs, type JobsListOptions, type JobsRelation, type JobsRow } from '../reads/jobs';
import type { Page } from '../reads/factory';

/**
 * TanStack Query hooks for every exposed schema.
 *
 * Each schema gets three hooks: a keyset list, an infinite (cursor-paginated)
 * list, and a single row. Row types flow from the generated Database type, so
 * a hook result is fully typed per relation with no hand-written contracts.
 *
 * Stale times follow FRONTEND_ARCHITECTURE.md §13.
 */

// --- tenancy ---------------------------------------------------------------
export function useTenancyList<R extends TenancyRelation>(
  scope: string,
  relation: R,
  options: TenancyListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<TenancyRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.tenancy.all(scope), 'list', relation, options],
    queryFn: () => tenancy.list(relation, options),
    staleTime: STALE_TIMES.reference,
    enabled,
  });
}

export function useInfiniteTenancyList<R extends TenancyRelation>(
  scope: string,
  relation: R,
  options: TenancyListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<TenancyRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.tenancy.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      tenancy.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<TenancyRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.reference,
    enabled,
  });
}

export function useTenancyOne<R extends TenancyRelation>(
  scope: string,
  relation: R,
  column: keyof TenancyRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<TenancyRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.tenancy.all(scope), 'one', relation, column, value],
    queryFn: () => tenancy.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.reference,
    enabled: value !== undefined,
  });
}

// --- identity ---------------------------------------------------------------
export function useIdentityList<R extends IdentityRelation>(
  scope: string,
  relation: R,
  options: IdentityListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<IdentityRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.identity.all(scope), 'list', relation, options],
    queryFn: () => identity.list(relation, options),
    staleTime: STALE_TIMES.profile,
    enabled,
  });
}

export function useInfiniteIdentityList<R extends IdentityRelation>(
  scope: string,
  relation: R,
  options: IdentityListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<IdentityRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.identity.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      identity.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<IdentityRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.profile,
    enabled,
  });
}

export function useIdentityOne<R extends IdentityRelation>(
  scope: string,
  relation: R,
  column: keyof IdentityRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<IdentityRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.identity.all(scope), 'one', relation, column, value],
    queryFn: () => identity.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.profile,
    enabled: value !== undefined,
  });
}

// --- academic ---------------------------------------------------------------
export function useAcademicList<R extends AcademicRelation>(
  scope: string,
  relation: R,
  options: AcademicListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<AcademicRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.academic.all(scope), 'list', relation, options],
    queryFn: () => academic.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfiniteAcademicList<R extends AcademicRelation>(
  scope: string,
  relation: R,
  options: AcademicListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<AcademicRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.academic.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      academic.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<AcademicRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useAcademicOne<R extends AcademicRelation>(
  scope: string,
  relation: R,
  column: keyof AcademicRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<AcademicRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.academic.all(scope), 'one', relation, column, value],
    queryFn: () => academic.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

// --- transport ---------------------------------------------------------------
export function useTransportList<R extends TransportRelation>(
  scope: string,
  relation: R,
  options: TransportListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<TransportRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.transport.all(scope), 'list', relation, options],
    queryFn: () => transport.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfiniteTransportList<R extends TransportRelation>(
  scope: string,
  relation: R,
  options: TransportListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<TransportRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.transport.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      transport.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<TransportRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useTransportOne<R extends TransportRelation>(
  scope: string,
  relation: R,
  column: keyof TransportRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<TransportRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.transport.all(scope), 'one', relation, column, value],
    queryFn: () => transport.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

// --- safety ---------------------------------------------------------------
export function useSafetyList<R extends SafetyRelation>(
  scope: string,
  relation: R,
  options: SafetyListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<SafetyRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.safety.all(scope), 'list', relation, options],
    queryFn: () => safety.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfiniteSafetyList<R extends SafetyRelation>(
  scope: string,
  relation: R,
  options: SafetyListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<SafetyRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.safety.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      safety.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<SafetyRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useSafetyOne<R extends SafetyRelation>(
  scope: string,
  relation: R,
  column: keyof SafetyRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<SafetyRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.safety.all(scope), 'one', relation, column, value],
    queryFn: () => safety.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

// --- comms ---------------------------------------------------------------
export function useCommsList<R extends CommsRelation>(
  scope: string,
  relation: R,
  options: CommsListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<CommsRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.comms.all(scope), 'list', relation, options],
    queryFn: () => comms.list(relation, options),
    staleTime: STALE_TIMES.realtime,
    enabled,
  });
}

export function useInfiniteCommsList<R extends CommsRelation>(
  scope: string,
  relation: R,
  options: CommsListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<CommsRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.comms.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) => comms.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<CommsRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.realtime,
    enabled,
  });
}

export function useCommsOne<R extends CommsRelation>(
  scope: string,
  relation: R,
  column: keyof CommsRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<CommsRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.comms.all(scope), 'one', relation, column, value],
    queryFn: () => comms.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.realtime,
    enabled: value !== undefined,
  });
}

// --- approvals ---------------------------------------------------------------
export function useApprovalsList<R extends ApprovalsRelation>(
  scope: string,
  relation: R,
  options: ApprovalsListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<ApprovalsRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.approvals.all(scope), 'list', relation, options],
    queryFn: () => approvals.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfiniteApprovalsList<R extends ApprovalsRelation>(
  scope: string,
  relation: R,
  options: ApprovalsListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<ApprovalsRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.approvals.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      approvals.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<ApprovalsRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useApprovalsOne<R extends ApprovalsRelation>(
  scope: string,
  relation: R,
  column: keyof ApprovalsRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<ApprovalsRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.approvals.all(scope), 'one', relation, column, value],
    queryFn: () => approvals.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

// --- billing ---------------------------------------------------------------
export function useBillingList<R extends BillingRelation>(
  scope: string,
  relation: R,
  options: BillingListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<BillingRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.billing.all(scope), 'list', relation, options],
    queryFn: () => billing.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfiniteBillingList<R extends BillingRelation>(
  scope: string,
  relation: R,
  options: BillingListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<BillingRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.billing.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      billing.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<BillingRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useBillingOne<R extends BillingRelation>(
  scope: string,
  relation: R,
  column: keyof BillingRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<BillingRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.billing.all(scope), 'one', relation, column, value],
    queryFn: () => billing.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

// --- media ---------------------------------------------------------------
export function useMediaList<R extends MediaRelation>(
  scope: string,
  relation: R,
  options: MediaListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<MediaRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.media.all(scope), 'list', relation, options],
    queryFn: () => media.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfiniteMediaList<R extends MediaRelation>(
  scope: string,
  relation: R,
  options: MediaListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<MediaRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.media.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) => media.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<MediaRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useMediaOne<R extends MediaRelation>(
  scope: string,
  relation: R,
  column: keyof MediaRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<MediaRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.media.all(scope), 'one', relation, column, value],
    queryFn: () => media.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

// --- reports ---------------------------------------------------------------
export function useReportsList<R extends ReportsRelation>(
  scope: string,
  relation: R,
  options: ReportsListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<ReportsRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.reports.all(scope), 'list', relation, options],
    queryFn: () => reports.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfiniteReportsList<R extends ReportsRelation>(
  scope: string,
  relation: R,
  options: ReportsListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<ReportsRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.reports.all(scope), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      reports.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<ReportsRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useReportsOne<R extends ReportsRelation>(
  scope: string,
  relation: R,
  column: keyof ReportsRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<ReportsRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.reports.all(scope), 'one', relation, column, value],
    queryFn: () => reports.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

// --- platform ---------------------------------------------------------------
export function usePlatformList<R extends PlatformRelation>(
  relation: R,
  options: PlatformListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<PlatformRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.platform.all(), 'list', relation, options],
    queryFn: () => platform.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfinitePlatformList<R extends PlatformRelation>(
  relation: R,
  options: PlatformListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<PlatformRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.platform.all(), 'infinite', relation, options],
    queryFn: ({ pageParam }) =>
      platform.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<PlatformRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function usePlatformOne<R extends PlatformRelation>(
  relation: R,
  column: keyof PlatformRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<PlatformRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.platform.all(), 'one', relation, column, value],
    queryFn: () => platform.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

// --- jobs ---------------------------------------------------------------
export function useJobsList<R extends JobsRelation>(
  relation: R,
  options: JobsListOptions<R> = {},
  enabled = true,
): UseQueryResult<Page<JobsRow<R>>> {
  return useQuery({
    queryKey: [...queryKeys.jobs.all(), 'list', relation, options],
    queryFn: () => jobs.list(relation, options),
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useInfiniteJobsList<R extends JobsRelation>(
  relation: R,
  options: JobsListOptions<R> = {},
  enabled = true,
): UseInfiniteQueryResult<{ pages: Page<JobsRow<R>>[]; pageParams: unknown[] }> {
  return useInfiniteQuery({
    queryKey: [...queryKeys.jobs.all(), 'infinite', relation, options],
    queryFn: ({ pageParam }) => jobs.list(relation, { ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<JobsRow<R>>) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.operational,
    enabled,
  });
}

export function useJobsOne<R extends JobsRelation>(
  relation: R,
  column: keyof JobsRow<R> & string,
  value: string | number | boolean | undefined,
): UseQueryResult<JobsRow<R> | null> {
  return useQuery({
    queryKey: [...queryKeys.jobs.all(), 'one', relation, column, value],
    queryFn: () => jobs.one(relation, column, value as string | number | boolean),
    staleTime: STALE_TIMES.operational,
    enabled: value !== undefined,
  });
}

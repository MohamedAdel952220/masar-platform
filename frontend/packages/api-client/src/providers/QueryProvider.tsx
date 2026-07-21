import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AppError } from '../errors';

/**
 * TanStack Query configuration (FRONTEND_ARCHITECTURE.md §12/§13).
 *
 * Retry policy is the security-relevant part: 4xx is never retried, and any
 * AppError that is not explicitly retryable is terminal. Auth failures are
 * handled by the auth layer, which clears this cache on logout.
 */
export const STALE_TIMES = {
  reference: 60 * 60 * 1000, // 1h  — plan catalog, fee items
  profile: 5 * 60 * 1000, // 5m  — children, staff, classrooms
  operational: 30 * 1000, // 30s — attendance, trips, requests
  realtime: 0, // socket-driven
  analytics: 5 * 60 * 1000, // 5m  — plus a visible computed_at indicator
} as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIMES.operational,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof AppError) return error.retryable && failureCount < 3;
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      },
      mutations: {
        // Mutations are never auto-retried: several backend RPCs are not
        // idempotent (BACKEND_CERTIFICATION.md §7.1).
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

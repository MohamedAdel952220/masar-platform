import { createBrowserRouter } from 'react-router-dom';
import { ActivityLogRoute } from './ActivityLogRoute';
import { AnalyticsRoute } from './AnalyticsRoute';
import { ConsoleLayout } from './ConsoleLayout';
import { NotFound } from './NotFound';
import { OverviewRoute } from './OverviewRoute';
import { ServiceHealthRoute } from './ServiceHealthRoute';
import { SupportTicketsRoute } from './SupportTicketsRoute';
import { SystemHealthRoute } from './SystemHealthRoute';
import { TenantBillingRoute } from './TenantBillingRoute';
import { AuthGate } from './auth/AuthGate';

/**
 * Platform Admin routing.
 *
 * Every data route sits behind AuthGate, which resolves the session, confirms
 * the platform_admin role, and satisfies MFA before the console mounts. RLS
 * remains the authorization boundary — these routes exist so a user never
 * lands on a screen that would render empty.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <ConsoleLayout />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { index: true, element: <OverviewRoute /> },
      { path: 'service-health', element: <ServiceHealthRoute /> },
      { path: 'system-health', element: <SystemHealthRoute /> },
      { path: 'support', element: <SupportTicketsRoute /> },
      { path: 'billing', element: <TenantBillingRoute /> },
      { path: 'analytics', element: <AnalyticsRoute /> },
      { path: 'audit', element: <ActivityLogRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

import { createBrowserRouter } from 'react-router-dom';
import { HomeRoute } from './HomeRoute';
import { LogRoute } from './LogRoute';
import { MoreRoute } from './MoreRoute';
import { NotFound } from './NotFound';
import { NotificationsRoute } from './NotificationsRoute';
import { PickupRoute } from './PickupRoute';
import { ReceptionShell } from './ReceptionShell';
import { ScanRoute } from './ScanRoute';
import { SettingsRoute } from './SettingsRoute';
import { VisitorsRoute } from './VisitorsRoute';
import { AuthGate } from './auth/AuthGate';

/**
 * Reception App routing.
 *
 * Five primary tabs (Home · Visitors · Scan · Log · More), with Scan given the
 * centre position because it is the app's reason to exist. Every route sits
 * behind AuthGate, which resolves the session and confirms the reception role.
 * RLS — plus the `current_role() = 'reception'` check inside both scan RPCs —
 * remains the authorization boundary.
 *
 * There is deliberately NO route that lists pickup passes. §13.4 makes
 * withholding that query path an intentional second layer over RLS; a route
 * would be the first thing to erode it.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <ReceptionShell />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'visitors', element: <VisitorsRoute /> },
      { path: 'scan', element: <ScanRoute /> },
      { path: 'log', element: <LogRoute /> },
      { path: 'more', element: <MoreRoute /> },
      { path: 'pickup', element: <PickupRoute /> },
      { path: 'notifications', element: <NotificationsRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

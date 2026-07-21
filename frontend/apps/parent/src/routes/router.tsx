import { createBrowserRouter } from 'react-router-dom';
import { AttendanceRoute } from './AttendanceRoute';
import { BillingRoute } from './BillingRoute';
import { CamerasRoute } from './CamerasRoute';
import { ChatRoute } from './ChatRoute';
import { ChildRoute } from './ChildRoute';
import { DayPathRoute } from './DayPathRoute';
import { HomeRoute } from './HomeRoute';
import { MoreRoute } from './MoreRoute';
import { NotFound } from './NotFound';
import { NotificationsRoute } from './NotificationsRoute';
import { ParentShell } from './ParentShell';
import { PayRoute } from './PayRoute';
import { ProgressRoute } from './ProgressRoute';
import { ReportsRoute } from './ReportsRoute';
import { SettingsRoute } from './SettingsRoute';
import { TripRoute } from './TripRoute';
import { AuthGate } from './auth/AuthGate';

/**
 * Parent App routing.
 *
 * Five primary tabs (Home · Day · Bus · Chat · More) with everything else one
 * level deeper. Every route sits behind AuthGate, which resolves the session,
 * confirms the guardian role, and mounts the selected-child context.
 *
 * There are NO per-child routes (`/child/:id`). The selected child is app-wide
 * state, because a parent thinks in terms of "my child" rather than a record
 * id — and because an id in the URL would suggest an addressability that RLS
 * does not grant. Scope is decided by the database, not by the path.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <ParentShell />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'day', element: <DayPathRoute /> },
      { path: 'trip', element: <TripRoute /> },
      { path: 'chat', element: <ChatRoute /> },
      { path: 'more', element: <MoreRoute /> },
      { path: 'child', element: <ChildRoute /> },
      { path: 'attendance', element: <AttendanceRoute /> },
      { path: 'progress', element: <ProgressRoute /> },
      { path: 'reports', element: <ReportsRoute /> },
      { path: 'cameras', element: <CamerasRoute /> },
      { path: 'billing', element: <BillingRoute /> },
      { path: 'pay', element: <PayRoute /> },
      { path: 'notifications', element: <NotificationsRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

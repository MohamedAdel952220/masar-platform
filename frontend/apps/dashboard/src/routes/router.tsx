import { createBrowserRouter } from 'react-router-dom';
import { AnalyticsRoute } from './AnalyticsRoute';
import { ApprovalsRoute } from './ApprovalsRoute';
import { AttendanceRoute } from './AttendanceRoute';
import { BillingRoute } from './BillingRoute';
import { CamerasRoute } from './CamerasRoute';
import { ChildrenRoute } from './ChildrenRoute';
import { ClassroomsRoute } from './ClassroomsRoute';
import { DashboardLayout } from './DashboardLayout';
import { HomeRoute } from './HomeRoute';
import { NotFound } from './NotFound';
import { NotificationsRoute } from './NotificationsRoute';
import { RecordsRoute } from './RecordsRoute';
import { ReportsRoute } from './ReportsRoute';
import { SettingsRoute } from './SettingsRoute';
import { TeachersRoute } from './TeachersRoute';
import { TimelineRoute } from './TimelineRoute';
import { AuthGate } from './auth/AuthGate';

/**
 * Nursery Dashboard routing.
 *
 * Every data route sits behind AuthGate, which resolves the session and
 * confirms a manager or teacher role before the console mounts. RLS remains
 * the authorization boundary — these routes exist so a user never lands on a
 * screen that would render empty.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <DashboardLayout />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'timeline', element: <TimelineRoute /> },
      { path: 'analytics', element: <AnalyticsRoute /> },
      { path: 'children', element: <ChildrenRoute /> },
      { path: 'classrooms', element: <ClassroomsRoute /> },
      { path: 'teachers', element: <TeachersRoute /> },
      { path: 'attendance', element: <AttendanceRoute /> },
      { path: 'records', element: <RecordsRoute /> },
      { path: 'reports', element: <ReportsRoute /> },
      { path: 'approvals', element: <ApprovalsRoute /> },
      { path: 'billing', element: <BillingRoute /> },
      { path: 'cameras', element: <CamerasRoute /> },
      { path: 'notifications', element: <NotificationsRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

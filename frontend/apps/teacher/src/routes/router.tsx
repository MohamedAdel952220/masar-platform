import { createBrowserRouter } from 'react-router-dom';
import { AiPolishRoute } from './AiPolishRoute';
import { AttendanceRoute } from './AttendanceRoute';
import { ChatRoute } from './ChatRoute';
import { ClassroomRoute } from './ClassroomRoute';
import { EvaluationsRoute } from './EvaluationsRoute';
import { HomeRoute } from './HomeRoute';
import { MoreRoute } from './MoreRoute';
import { NotFound } from './NotFound';
import { NotificationsRoute } from './NotificationsRoute';
import { ObservationsRoute } from './ObservationsRoute';
import { ReportsRoute } from './ReportsRoute';
import { SettingsRoute } from './SettingsRoute';
import { StudentsRoute } from './StudentsRoute';
import { TeacherShell } from './TeacherShell';
import { AuthGate } from './auth/AuthGate';

/**
 * Teacher App routing.
 *
 * Five primary tabs (Home, Register, Students, Chat, More) with secondary
 * destinations one level deeper. Every route sits behind AuthGate, which
 * resolves the session and confirms the teacher role. RLS remains the
 * authorization boundary.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <TeacherShell />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'attendance', element: <AttendanceRoute /> },
      { path: 'students', element: <StudentsRoute /> },
      { path: 'chat', element: <ChatRoute /> },
      { path: 'more', element: <MoreRoute /> },
      { path: 'classroom', element: <ClassroomRoute /> },
      { path: 'observations', element: <ObservationsRoute /> },
      { path: 'evaluations', element: <EvaluationsRoute /> },
      { path: 'ai/polish', element: <AiPolishRoute /> },
      { path: 'reports', element: <ReportsRoute /> },
      { path: 'notifications', element: <NotificationsRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

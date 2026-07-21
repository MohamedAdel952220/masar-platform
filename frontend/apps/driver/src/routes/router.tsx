import { createBrowserRouter } from 'react-router-dom';
import { BusRoute } from './BusRoute';
import { DriverShell } from './DriverShell';
import { GpsRoute } from './GpsRoute';
import { HomeRoute } from './HomeRoute';
import { ManifestRoute } from './ManifestRoute';
import { MoreRoute } from './MoreRoute';
import { NotFound } from './NotFound';
import { NotificationsRoute } from './NotificationsRoute';
import { RouteRoute } from './RouteRoute';
import { SettingsRoute } from './SettingsRoute';
import { TripRoute } from './TripRoute';
import { TripsRoute } from './TripsRoute';
import { AuthGate } from './auth/AuthGate';

/**
 * Driver App routing.
 *
 * Five primary tabs (Home · Trip · Riders · Route · More). The four hot-path
 * screens are one tap from anywhere; everything a driver does not need while
 * moving sits behind More.
 *
 * Every route is behind AuthGate, which resolves the session, confirms the
 * driver role, and mounts the trip context. That context — not any route —
 * owns GPS tracking and the two realtime subscriptions, so navigating between
 * tabs never interrupts position reporting.
 *
 * There is deliberately no trip-history route and no route that can address
 * another driver's bus or trip by id. §12 scopes a driver to their own bus and
 * own trips, and a URL implying otherwise would be the first step towards
 * eroding that.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <DriverShell />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'trip', element: <TripRoute /> },
      { path: 'manifest', element: <ManifestRoute /> },
      { path: 'route', element: <RouteRoute /> },
      { path: 'more', element: <MoreRoute /> },
      { path: 'trips', element: <TripsRoute /> },
      { path: 'bus', element: <BusRoute /> },
      { path: 'gps', element: <GpsRoute /> },
      { path: 'notifications', element: <NotificationsRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

import type { MasarClaims } from '@masar/auth';

/**
 * Driver App scope helpers (BACKEND_ARCHITECTURE.md §12).
 *
 * IMPORTANT: these are UX affordances only. RLS is the authorization boundary,
 * and all four driver RPCs additionally re-check `current_role() = 'driver'`
 * AND `bus_id = ANY(current_driver_bus_ids())` server-side. A forged client
 * cannot start, ping, or complete a trip on someone else's bus.
 *
 * §12 row for `driver`, as deployed. It is the narrowest role in the system:
 *   Children ............ R (OWN BUS RIDERS, MINIMAL FIELDS — see below)
 *   Buses/Trips ......... RU (own trip, own bus)
 *   Trip stops/riders ... RU (own trip)
 *   GPS pings ........... C (own trip)
 *   Day-path history .... C (system-generated via trip actions)
 *   Announcements ....... R (targeted)
 *   Notifications ....... R, U (own)
 *   Device tokens ....... CRUD (own)
 *   Notification prefs .. CRUD (own)
 *
 * Everything else is absent, and absent here too: no attendance, evaluations,
 * concerns, billing, chat, cameras, AI reports, pickup passes, other drivers,
 * other buses, or tenant-wide anything.
 *
 * ══ MINIMAL CHILD FIELDS ARE ENFORCED SERVER-SIDE ══
 *
 * §12 grants the driver "R (own bus riders, minimal fields)". That is not a
 * client-side redaction task — the backend ships `children_driver_safe()`, a
 * server-gated function returning EXACTLY the driver-safe columns:
 *
 *   id, tenant_id, name, name_ar, classroom_id, photo_object_id,
 *   address_line, address_lat, address_lng, area, building, city
 *
 * No allergies, no blood type, no date of birth, no parent names, phones,
 * national IDs, jobs, notes, package or membership status. The driver needs a
 * name and an address; the medical and family record is none of their business.
 *
 * THIS APP READS THAT FUNCTION AND NEVER `academic.children`. Reading the base
 * table and dropping columns in the client would place a privacy boundary in
 * client code, where a future edit can quietly widen it. Letting the database
 * decide means the sensitive columns never leave the server at all.
 */

export function canOpenDriverApp(claims: MasarClaims): boolean {
  return claims.role === 'driver';
}

/** Starting, pinging and completing are all role-gated server-side. */
export function canRunTrip(claims: MasarClaims): boolean {
  return claims.role === 'driver';
}

export function canUpdateChildStatus(claims: MasarClaims): boolean {
  return claims.role === 'driver';
}

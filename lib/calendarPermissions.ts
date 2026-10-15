// Administrator permissions are configured on the server, never by a browser field.
export function isCalendarAdminEmail(email: unknown): boolean {
  if (typeof email !== "string" || !email.trim()) return false;
  const allowed = (process.env.CALENDAR_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 1 && allowed[0] === email.trim().toLowerCase();
}

export function canManageReservations(token: {
  email?: unknown;
  calendarEmailVerified?: unknown;
} | null): boolean {
  return token?.calendarEmailVerified === true && isCalendarAdminEmail(token.email);
}

// Public reservations have no visitor account or email attached.
export const PUBLIC_RESERVATION_OWNER = "public-link";

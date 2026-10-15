// Administrator permissions are configured on the server, never by a browser field.
export function isCalendarAdminEmail(email: unknown): boolean {
  if (typeof email !== "string" || !email.trim()) return false;
  const allowed = (process.env.CALENDAR_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export function canManageReservations(token: {
  email?: unknown;
  calendarEmailVerified?: unknown;
} | null): boolean {
  return token?.calendarEmailVerified === true && isCalendarAdminEmail(token.email);
}

export const categories = {
  personal: { label: "Personal", color: "#9064bc", background: "#f1eafa" },
  trabajo: { label: "Trabajo", color: "#387c65", background: "#e5f1e9" },
  bienestar: { label: "Bienestar", color: "#bb813a", background: "#fcf0dc" },
  social: { label: "Social", color: "#5687b6", background: "#eaf1fa" },
};
export type Category = string;
export type UserCalendar = { id: string; label: string; color: string };
export const defaultCalendars: UserCalendar[] = Object.entries(categories).map(
  ([id, { label, color }]) => ({ id, label, color })
);
export const validCalendarId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
export const validColor = (color: unknown): color is string =>
  typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color);
export function validCalendar(value: unknown): value is UserCalendar {
  if (!value || typeof value !== "object") return false;
  const c = value as UserCalendar;
  return validCalendarId(c.id) && typeof c.label === "string" &&
    c.label.trim().length > 0 && c.label.length <= 60 && validColor(c.color);
}
export function mergeCalendars(saved: UserCalendar[]): UserCalendar[] {
  const merged = new Map(defaultCalendars.map((c) => [c.id, { ...c }]));
  saved.forEach((c) => merged.set(c.id, c));
  return Array.from(merged.values());
}
// Keep arbitrary chosen colors readable on a light event background.
export function colorAppearance(color: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const luminance = (values: number[]) => values.reduce((sum, value, i) => {
    const channel = value / 255;
    return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
  }, 0);
  const tint = rgb.map((v) => Math.round(v * 0.32 + 255 * 0.68));
  const light = luminance(rgb);
  const background = "#" + tint.map((v) => v.toString(16).padStart(2, "0")).join("");
  return { color, background,
    text: (luminance(tint) + 0.05) / (light + 0.05) >= 4.5 ? color : "#26382f",
    ink: (light + 0.05) / 0.05 > 1.05 / (light + 0.05) ? "#000000" : "#ffffff" };
}
export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  category: Category;
  color?: string;
  owner?: string;
};
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
export const fromKey = (date: string) => new Date(`${date}T12:00:00`);
export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
export const monthDays = (date: Date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const start = addDays(first, -(first.getDay() + 6) % 7);
  const count =
    Math.ceil(
      (((first.getDay() + 6) % 7) +
        new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) /
        7
    ) * 7;
  return Array.from({ length: count }, (_, i) => addDays(start, i));
};
export function validEvent(value: unknown): value is Omit<CalendarEvent, "id"> {
  if (!value || typeof value !== "object") return false;
  const e = value as CalendarEvent;
  return (
    typeof e.title === "string" &&
    e.title.trim().length > 0 &&
    e.title.length <= 120 &&
    typeof e.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    Number(e.date.slice(0, 4)) >= 1900 &&
    Number(e.date.slice(0, 4)) <= 9999 &&
    !isNaN(fromKey(e.date).getTime()) &&
    dateKey(fromKey(e.date)) === e.date &&
    typeof e.start === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(e.start) &&
    typeof e.end === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(e.end) &&
    e.end > e.start &&
    typeof e.location === "string" &&
    e.location.length <= 200 &&
    typeof e.description === "string" &&
    e.description.length <= 2000 &&
    validCalendarId(e.category) &&
    (e.color === undefined || e.color === "" || validColor(e.color))
  );
}
export function demoEvents(today: Date): CalendarEvent[] {
  const sample: [number, string, string, string, Category, string][] = [
    [
      0,
      "Un café y nuevas ideas",
      "09:00",
      "10:00",
      "personal",
      "Café de la esquina",
    ],
    [0, "Reunión de equipo", "11:00", "12:00", "trabajo", "Google Meet"],
    [0, "Un momento para mí", "18:00", "19:00", "bienestar", "Parque central"],
    [2, "Almuerzo con amigos", "13:00", "14:30", "social", "Restaurante Oliva"],
    [-2, "Planificación de la semana", "10:00", "11:00", "trabajo", "Oficina"],
    [5, "Clase de yoga", "08:00", "09:00", "bienestar", "Estudio Norte"],
    [
      7,
      "Presentación del proyecto",
      "10:30",
      "11:30",
      "trabajo",
      "Sala de reuniones",
    ],
    [-5, "Tarde de lectura", "17:00", "18:00", "personal", "En casa"],
    [10, "Cena en familia", "20:00", "22:00", "social", "En casa"],
  ];
  return sample.map(([offset, title, start, end, category, location], i) => ({
    id: `demo-${i}`,
    title,
    start,
    end,
    category,
    location,
    date: dateKey(addDays(today, offset)),
    description: "Reserva de ejemplo. Abre para consultar sus datos.",
  }));
}

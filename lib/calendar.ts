export const categories = {
  personal: { label: "Personal", color: "#9064bc", background: "#f1eafa" },
  trabajo: { label: "Trabajo", color: "#387c65", background: "#e5f1e9" },
  bienestar: { label: "Bienestar", color: "#bb813a", background: "#fcf0dc" },
  social: { label: "Social", color: "#5687b6", background: "#eaf1fa" },
};
export type Category = keyof typeof categories;
export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  category: Category;
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
    Object.prototype.hasOwnProperty.call(categories, e.category)
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
    description: "Evento de ejemplo. Puedes editarlo o eliminarlo.",
  }));
}

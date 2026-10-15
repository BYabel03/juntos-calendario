import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  addDays,
  CalendarEvent,
  categories,
  Category,
  dateKey,
  demoEvents,
  fromKey,
  monthDays,
  validEvent,
} from "lib/calendar";
import s from "./calendar.module.css";

// TypeScript 4.6 predates the native dialog methods in lib.dom.
interface NativeDialog extends HTMLDialogElement {
  open: boolean;
  showModal(): void;
  close(): void;
}

type IconName =
  | "calendar"
  | "chevron"
  | "plus"
  | "search"
  | "pin"
  | "clock"
  | "close"
  | "arrow"
  | "sun"
  | "check"
  | "grid"
  | "list"
  | "logout";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    check: <path d="m5 12 4 4 10-10" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    logout: (
      <>
        <path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString("es-ES", options);
const categoryStyle = (category: Category): CSSProperties =>
  ({
    "--event-color": categories[category].color,
    "--event-bg": categories[category].background,
  } as CSSProperties);
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const storageKey = "juntos-calendar-demo-v1";

export default function Calendar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [today, setToday] = useState<Date | null>(null);
  const [cursor, setCursor] = useState(new Date(2026, 0, 1, 12));
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [hidden, setHidden] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [providers, setProviders] = useState<string[] | null>(null);
  const [providerError, setProviderError] = useState(false);
  const dialogRef = useRef<NativeDialog>(null);
  const loginRef = useRef<NativeDialog>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const scopeRef = useRef(0);
  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setCursor(now);
    setSelected(dateKey(now));
  }, []);

  useEffect(() => {
    const scope = ++scopeRef.current;
    setEditing(null);
    setSaving(false);
    setNotice("");
    setLoaded(false);
    setEvents([]);
    if (!today || status === "loading") return;
    const abort = new AbortController();
    setError("");
    if (isAuthenticated) {
      fetch("/api/events", { signal: abort.signal })
        .then(async (res) => {
          if (!res.ok)
            throw new Error(
              "No pudimos cargar tus eventos. Comprueba la conexión y vuelve a intentarlo."
            );
          return res.json();
        })
        .then((data) => {
          if (scope !== scopeRef.current) return;
          setEvents(data);
          setLoaded(true);
        })
        .catch((e) => {
          if (scope === scopeRef.current && e.name !== "AbortError")
            setError(e.message);
        });
    } else {
      try {
        const saved = localStorage.getItem(storageKey);
        const data = saved ? JSON.parse(saved) : demoEvents(today);
        if (
          !Array.isArray(data) ||
          !data.every((e) => typeof e.id === "string" && validEvent(e))
        )
          throw new Error();
        setEvents(data);
        setLoaded(true);
      } catch {
        setError(
          "No pudimos leer la vista de prueba. Comprueba el almacenamiento de tu navegador."
        );
      }
    }
    return () => {
      scopeRef.current = scope + 1;
      abort.abort();
    };
  }, [today, status, isAuthenticated, session?.user?.email]);

  useEffect(() => {
    if (editing && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!editing && dialogRef.current?.open) dialogRef.current.close();
  }, [editing]);
  useEffect(() => {
    if (loginOpen) loginRef.current?.showModal();
    else loginRef.current?.close();
  }, [loginOpen]);

  useEffect(() => {
    if (typeof router.query.error === "string") setLoginOpen(true);
  }, [router.query.error]);

  useEffect(() => {
    if (!loginOpen || isAuthenticated) return;
    let active = true;
    setProviders(null);
    setProviderError(false);
    fetch("/api/auth/providers")
      .then(async (response) => {
        if (!response.ok) throw new Error("Provider lookup failed");
        return response.json();
      })
      .then((data) => {
        if (active) setProviders(Object.keys(data));
      })
      .catch(() => {
        if (active) setProviderError(true);
      });
    return () => {
      active = false;
    };
  }, [loginOpen, isAuthenticated]);

  const visible = events
    .filter(
      (e) =>
        !hidden.includes(e.category) &&
        `${e.title} ${e.location} ${e.description}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())
    )
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const onDate = (key: string) => visible.filter((e) => e.date === key);
  const selectedEvents = onDate(selected);
  const days = monthDays(cursor);
  const weekStart = addDays(cursor, -((cursor.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthCount = visible.filter(
    (e) => e.date.slice(0, 7) === dateKey(cursor).slice(0, 7)
  ).length;
  function navigate(direction: number) {
    setCursor(
      view === "week"
        ? addDays(cursor, direction * 7)
        : new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1, 12)
    );
  }
  function pick(date: Date) {
    setSelected(dateKey(date));
    setCursor(date);
  }
  function openEvent(event?: CalendarEvent, date = selected) {
    triggerRef.current = document.activeElement as HTMLElement;
    setNotice("");
    setError("");
    setEditing(
      event
        ? { ...event }
        : {
            id: "",
            title: "",
            date,
            start: "09:00",
            end: "10:00",
            location: "",
            description: "",
            category: "trabajo",
          }
    );
  }
  function closeEditor() {
    if (saving) return;
    setEditing(null);
    triggerRef.current?.focus();
  }
  async function persist(event: CalendarEvent, remove = false) {
    if (saving || !loaded) return;
    const scope = scopeRef.current;
    setSaving(true);
    setError("");
    try {
      let saved = event;
      if (isAuthenticated) {
        const res = await fetch("/api/events", {
          method: remove ? "DELETE" : event.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        if (!remove) saved = await res.json();
      } else if (!saved.id) saved = { ...event, id: crypto.randomUUID() };
      if (scope !== scopeRef.current) return;
      const next = remove
        ? events.filter((e) => e.id !== event.id)
        : [...events.filter((e) => e.id !== event.id), saved];
      if (!isAuthenticated)
        localStorage.setItem(storageKey, JSON.stringify(next));
      setEvents(next);
      setSelected(event.date);
      setCursor(fromKey(event.date));
      setNotice(remove ? "Evento eliminado." : "Evento guardado.");
      setEditing(null);
      triggerRef.current?.focus();
    } catch (e) {
      if (scope !== scopeRef.current) return;
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar. Inténtalo de nuevo."
      );
    } finally {
      if (scope === scopeRef.current) setSaving(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !validEvent(editing)) {
      setError(
        "La hora de fin debe ser posterior al inicio. Revisa los datos del evento."
      );
      return;
    }
    persist(editing);
  }
  function update(field: keyof CalendarEvent, value: string) {
    setEditing((event) => (event ? { ...event, [field]: value } : null));
  }
  const eventButton = (event: CalendarEvent, compact = false) => (
    <button
      key={event.id}
      className={compact ? s.eventChip : s.eventCard}
      style={categoryStyle(event.category)}
      onClick={() => openEvent(event)}
      title={`${event.start} · ${event.title}`}
    >
      <span className={s.eventDot} />
      <span>
        <strong>{event.title}</strong>
        {!compact && (
          <small>
            {event.start} – {event.end}
            {event.location && ` · ${event.location}`}
          </small>
        )}
      </span>
      {compact && <time>{event.start}</time>}
    </button>
  );

  return (
    <div className={s.app}>
      <Head>
        <title>Juntos — Tu tiempo, a tu manera</title>
        <meta
          name="description"
          content="Un espacio para organizar tus días. Agenda eventos, elige un color y haz tiempo para lo que importa."
        />
        <link rel="icon" type="image/svg+xml" href="/calendar.svg" />
      </Head>
      <aside className={s.sidebar}>
        <Link href="/">
          <a className={s.brand}>
            <span className={s.brandIcon}>
              <Icon name="calendar" size={24} />
            </span>
            juntos<span className={s.brandPeriod}>.</span>
          </a>
        </Link>
        <div className={s.workspace}>
          <span className={s.workspaceAvatar}>M</span>
          <span>
            Mi espacio<small>Un lugar para tus planes</small>
          </span>
          <Icon name="chevron" size={15} />
        </div>
        <button
          className={s.create}
          onClick={() => openEvent()}
          disabled={!loaded}
        >
          <Icon name="plus" /> Crear evento
        </button>
        <div className={s.sideSection}>
          <span className={s.eyebrow}>MI ESPACIO</span>
          <button
            className={s.navActive}
            onClick={() => {
              setView("month");
              setQuery("");
            }}
          >
            <Icon name="calendar" /> Calendario <span className={s.smallDot} />
          </button>
          <button className={s.navItem} onClick={() => setView("agenda")}>
            <Icon name="list" /> Mi agenda <span>{monthCount}</span>
          </button>
        </div>
        <section className={s.miniCalendar} aria-label="Calendario pequeño">
          <div className={s.miniHeading}>
            <strong>
              {format(cursor, { month: "long", year: "numeric" })}
            </strong>
            <div>
              <button
                aria-label="Mes anterior"
                onClick={() =>
                  setCursor(
                    new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1, 12)
                  )
                }
                className={s.previous}
              >
                <Icon name="chevron" size={12} />
              </button>
              <button
                aria-label="Mes siguiente"
                onClick={() =>
                  setCursor(
                    new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12)
                  )
                }
              >
                <Icon name="chevron" size={12} />
              </button>
            </div>
          </div>
          <div className={s.miniGrid}>
            {weekdays.map((d) => (
              <span key={d}>{d[0]}</span>
            ))}
            {days.map((d) => (
              <button
                key={dateKey(d)}
                onClick={() => pick(d)}
                className={`${
                  d.getMonth() !== cursor.getMonth() ? s.muted : ""
                } ${dateKey(d) === selected ? s.miniSelected : ""}`}
              >
                {d.getDate()}
              </button>
            ))}
          </div>
        </section>
        <section className={s.sideSection}>
          <div className={s.sectionTitle}>
            <span className={s.eyebrow}>MIS CALENDARIOS</span>
            <Icon name="grid" size={14} />
          </div>
          <div className={s.categories}>
            {(Object.keys(categories) as Category[]).map((key) => (
              <label key={key} style={categoryStyle(key)}>
                <input
                  type="checkbox"
                  checked={!hidden.includes(key)}
                  onChange={() =>
                    setHidden(
                      hidden.includes(key)
                        ? hidden.filter((c) => c !== key)
                        : [...hidden, key]
                    )
                  }
                />
                <span className={s.checkbox}>
                  {!hidden.includes(key) && <Icon name="check" size={12} />}
                </span>
                {categories[key].label}
                <span className={s.categoryCount}>
                  {events.filter((e) => e.category === key).length}
                </span>
              </label>
            ))}
          </div>
        </section>
        <div className={s.sideBottom}>
          <div className={s.quote}>
            <Icon name="sun" size={24} />
            <p>
              Haz espacio para
              <br />
              <strong>lo que importa.</strong>
            </p>
            <span>Un día a la vez, a tu ritmo.</span>
            <div className={s.quoteDecoration} />
          </div>
          <button
            className={s.account}
            onClick={() =>
              isAuthenticated
                ? signOut({ callbackUrl: "/" })
                : setLoginOpen(true)
            }
          >
            <span className={s.avatar}>
              {session?.user?.name?.charAt(0) || "T"}
            </span>
            <span>
              {session?.user?.name || "Tu calendario"}
              <small>
                {isAuthenticated ? "Cerrar sesión" : "Iniciar sesión"}
              </small>
            </span>
            <Icon name={isAuthenticated ? "logout" : "arrow"} size={17} />
          </button>
        </div>
      </aside>
      <div className={s.main}>
        <header className={s.topbar}>
          <div className={s.breadcrumb}>
            Mi espacio <span>/</span> <strong>Calendario</strong>
          </div>
          <div className={s.topRight}>
            <span className={s.liveDot} />
            {isAuthenticated ? "Tu espacio personal" : "Vista de prueba"}
            <span className={s.topDivider} />
            <button
              className={s.avatar}
              aria-label="Abrir cuenta"
              onClick={() => setLoginOpen(true)}
            >
              {session?.user?.name?.charAt(0) || "T"}
            </button>
          </div>
        </header>
        <div className={s.content}>
          <div className={s.pageHeading}>
            <div>
              <div className={s.kicker}>
                <span /> CADA DÍA CUENTA
              </div>
              <h1>
                Tu tiempo, a tu manera<span>.</span>
              </h1>
              <p>Tus planes, tus momentos. Todo en un solo lugar.</p>
            </div>
            <button
              className={s.newEvent}
              onClick={() => openEvent()}
              disabled={!loaded}
            >
              <Icon name="plus" size={18} /> Nuevo evento
            </button>
          </div>
          <div className={s.toolbar}>
            <div className={s.monthNavigation}>
              <h2>
                {format(cursor, { month: "long" })}{" "}
                <span>{cursor.getFullYear()}</span>
              </h2>
              <div className={s.arrows}>
                <button
                  aria-label="Período anterior"
                  onClick={() => navigate(-1)}
                  className={s.previous}
                >
                  <Icon name="chevron" size={15} />
                </button>
                <button
                  aria-label="Período siguiente"
                  onClick={() => navigate(1)}
                >
                  <Icon name="chevron" size={15} />
                </button>
              </div>
              <button
                className={s.todayButton}
                onClick={() => today && pick(today)}
              >
                Hoy
              </button>
            </div>
            <div className={s.tools}>
              <label className={s.search}>
                <Icon name="search" size={17} />
                <input
                  aria-label="Buscar eventos"
                  placeholder="Buscar evento..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    aria-label="Limpiar búsqueda"
                    onClick={() => setQuery("")}
                  >
                    <Icon name="close" size={13} />
                  </button>
                )}
              </label>
              <div className={s.viewSwitch} aria-label="Vista del calendario">
                {(
                  [
                    ["month", "Mes"],
                    ["week", "Semana"],
                    ["agenda", "Agenda"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={view === key}
                    className={view === key ? s.viewActive : ""}
                    onClick={() => setView(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && !editing && (
            <div role="alert" className={s.error}>
              {error}{" "}
              <button onClick={() => window.location.reload()}>
                Reintentar
              </button>
            </div>
          )}
          <div role="status" className={s.status}>
            {notice}
          </div>
          <div className={s.calendarWrap}>
            {view === "month" && (
              <div
                className={s.calendar}
                style={{ "--weeks": days.length / 7 } as CSSProperties}
              >
                <div className={s.weekdays}>
                  {weekdays.map((d, i) => (
                    <span key={d} className={i > 4 ? s.weekendLabel : ""}>
                      {d.toUpperCase()}
                    </span>
                  ))}
                </div>
                <div className={s.monthGrid}>
                  {days.map((d, i) => {
                    const key = dateKey(d);
                    const dayEvents = onDate(key);
                    return (
                      <div
                        key={key}
                        className={`${s.day} ${i % 7 > 4 ? s.weekend : ""} ${
                          d.getMonth() !== cursor.getMonth() ? s.outside : ""
                        } ${key === selected ? s.selectedDay : ""}`}
                      >
                        <div className={s.dayHeading}>
                          <button
                            aria-label={format(d, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                            className={`${s.dayNumber} ${
                              today && key === dateKey(today) ? s.today : ""
                            }`}
                            onClick={() => setSelected(key)}
                          >
                            {d.getDate()}
                          </button>
                          <button
                            aria-label={`Crear evento el ${key}`}
                            className={s.dayAdd}
                            disabled={!loaded}
                            onClick={() => openEvent(undefined, key)}
                          >
                            <Icon name="plus" size={14} />
                          </button>
                        </div>
                        <div className={s.dayEvents}>
                          {dayEvents
                            .slice(0, 3)
                            .map((e) => eventButton(e, true))}
                          {dayEvents.length > 3 && (
                            <button
                              className={s.more}
                              onClick={() => {
                                pick(d);
                                setView("agenda");
                              }}
                            >
                              +{dayEvents.length - 3} más
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {view === "week" && (
              <div className={s.weekView}>
                {week.map((d) => (
                  <section key={dateKey(d)} className={s.weekColumn}>
                    <button
                      className={s.weekTitle}
                      onClick={() => setSelected(dateKey(d))}
                    >
                      <small>{format(d, { weekday: "short" })}</small>
                      <span
                        className={
                          today && dateKey(d) === dateKey(today) ? s.today : ""
                        }
                      >
                        {d.getDate()}
                      </span>
                    </button>
                    {onDate(dateKey(d)).map((e) => eventButton(e))}
                    <button
                      className={s.weekAdd}
                      disabled={!loaded}
                      onClick={() => openEvent(undefined, dateKey(d))}
                    >
                      <Icon name="plus" size={16} /> Añadir
                    </button>
                  </section>
                ))}
              </div>
            )}
            {view === "agenda" && (
              <div className={s.agendaView}>
                {visible.filter(
                  (e) => e.date.slice(0, 7) === dateKey(cursor).slice(0, 7)
                ).length === 0 ? (
                  <div className={s.empty}>
                    <Icon name="calendar" size={36} />
                    <h3>Espacio para nuevos planes</h3>
                    <p>
                      No hay eventos para este mes con los filtros actuales.
                    </p>
                    <button onClick={() => openEvent()} disabled={!loaded}>
                      Crear un evento <Icon name="plus" size={16} />
                    </button>
                  </div>
                ) : (
                  visible
                    .filter(
                      (e) => e.date.slice(0, 7) === dateKey(cursor).slice(0, 7)
                    )
                    .map((event) => (
                      <div className={s.agendaRow} key={event.id}>
                        <div>
                          <strong>{fromKey(event.date).getDate()}</strong>
                          <span>
                            {format(fromKey(event.date), {
                              weekday: "short",
                              month: "short",
                            })}
                          </span>
                        </div>
                        {eventButton(event)}
                      </div>
                    ))
                )}
              </div>
            )}
            <div className={s.calendarFooter}>
              <span>
                <span className={s.footerDot} />
                {monthCount} eventos este mes
              </span>
              <span>
                Hora local ·{" "}
                {today ? Intl.DateTimeFormat().resolvedOptions().timeZone : "—"}
              </span>
            </div>
          </div>
          <section className={s.dayPanel}>
            <div className={s.dayPanelHeading}>
              <div className={s.dayPanelIcon}>
                <Icon name="sun" size={22} />
              </div>
              <div>
                <h3>
                  {today && selected === dateKey(today)
                    ? "Tu día de hoy"
                    : "Tu día, de un vistazo"}
                </h3>
                <p>
                  {selected &&
                    format(fromKey(selected), {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                </p>
              </div>
              <span className={s.badge}>{selectedEvents.length} eventos</span>
              <button
                onClick={() => {
                  setCursor(fromKey(selected));
                  setView("agenda");
                }}
              >
                Ver agenda <Icon name="arrow" size={15} />
              </button>
            </div>
            <div className={s.dayPanelEvents}>
              {selectedEvents.length ? (
                selectedEvents.map((e) => (
                  <button
                    key={e.id}
                    className={s.summaryEvent}
                    onClick={() => openEvent(e)}
                    style={categoryStyle(e.category)}
                  >
                    <span className={s.summaryTime}>
                      {e.start}
                      <small>{e.end}</small>
                    </span>
                    <span className={s.summaryLine} />
                    <span>
                      <strong>{e.title}</strong>
                      <small>
                        <Icon name="pin" size={12} />{" "}
                        {e.location || "Sin ubicación"}
                      </small>
                    </span>
                    <Icon name="chevron" size={14} />
                  </button>
                ))
              ) : (
                <p className={s.noEvents}>
                  {loaded
                    ? "Un día con espacio para lo que tú elijas."
                    : "Cargando tu calendario…"}{" "}
                  <button onClick={() => openEvent()} disabled={!loaded}>
                    Añadir un plan
                  </button>
                </p>
              )}
            </div>
          </section>
          <footer className={s.footer}>
            <span>Un poco de orden. Mucho más espacio para vivir.</span>
            <span>
              hecho para tus días <span className={s.sparkle}>✳</span>
            </span>
          </footer>
          {!isAuthenticated && (
            <div className={s.demoNote}>
              Estás explorando eventos de ejemplo. Tus cambios se guardan en
              este navegador.{" "}
              <button onClick={() => setLoginOpen(true)}>
                Inicia sesión para tener tu calendario personal{" "}
                <Icon name="arrow" size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
      <dialog
        aria-label={editing?.id ? "Editar evento" : "Crear evento"}
        ref={dialogRef}
        className={s.dialog}
        onCancel={(e) => {
          e.preventDefault();
          closeEditor();
        }}
        onClose={() => {
          if (!saving) setEditing(null);
        }}
      >
        {editing && (
          <form onSubmit={submit}>
            <div className={s.dialogHeader}>
              <span className={s.kicker}>UN ESPACIO PARA TUS PLANES</span>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={closeEditor}
                disabled={saving}
              >
                <Icon name="close" />
              </button>
            </div>
            <h2>
              {editing.id ? "Tu evento" : "Un nuevo plan"}
              <span>.</span>
            </h2>
            <p className={s.dialogIntro}>Dale un lugar en tu calendario.</p>
            <label>
              Título del evento
              <input
                autoFocus
                required
                maxLength={120}
                placeholder="¿Qué tienes en mente?"
                value={editing.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </label>
            <label>
              Fecha
              <input
                required
                type="date"
                min="1900-01-01"
                max="9999-12-31"
                value={editing.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </label>
            <div className={s.formRow}>
              <label>
                Hora de inicio
                <input
                  required
                  type="time"
                  value={editing.start}
                  onChange={(e) => update("start", e.target.value)}
                />
              </label>
              <label>
                Hora de fin
                <input
                  required
                  type="time"
                  value={editing.end}
                  onChange={(e) => update("end", e.target.value)}
                />
              </label>
            </div>
            <label>
              Lugar
              <input
                maxLength={200}
                placeholder="Un lugar o enlace de videollamada"
                value={editing.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </label>
            <fieldset>
              <legend>Calendario y color</legend>
              <div className={s.colorOptions}>
                {(Object.keys(categories) as Category[]).map((key) => (
                  <label key={key} style={categoryStyle(key)}>
                    <input
                      type="radio"
                      name="category"
                      value={key}
                      checked={editing.category === key}
                      onChange={() => update("category", key)}
                    />
                    <span
                      className={
                        editing.category === key ? s.colorSelected : ""
                      }
                    >
                      <i />
                      {categories[key].label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Notas <span className={s.optional}>(opcional)</span>
              <textarea
                maxLength={2000}
                rows={2}
                placeholder="Los detalles que no quieres olvidar…"
                value={editing.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </label>
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <div className={s.dialogActions}>
              {editing.id && (
                <button
                  type="button"
                  className={s.delete}
                  disabled={saving}
                  onClick={() => {
                    if (window.confirm("¿Eliminar este evento?"))
                      persist(editing, true);
                  }}
                >
                  Eliminar
                </button>
              )}
              <button
                type="button"
                className={s.cancel}
                onClick={closeEditor}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className={s.newEvent} disabled={saving}>
                {saving ? "Guardando…" : "Guardar evento"}
                <Icon name="check" size={16} />
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        aria-label="Acceso a tu cuenta"
        ref={loginRef}
        className={`${s.dialog} ${s.loginDialog}`}
        onCancel={() => setLoginOpen(false)}
        onClose={() => setLoginOpen(false)}
      >
        <div className={s.dialogHeader}>
          <span className={s.brandIcon}>
            <Icon name="calendar" />
          </span>
          <button
            aria-label="Cerrar acceso"
            onClick={() => setLoginOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2>
          {isAuthenticated ? "Tu espacio personal" : "Tus días empiezan aquí"}
          <span>.</span>
        </h2>
        <p>
          {isAuthenticated
            ? `Sesión iniciada como ${session?.user?.email}.`
            : "Inicia sesión para guardar tus eventos en tu cuenta y consultarlos desde cualquier dispositivo."}
        </p>
        {isAuthenticated ? (
          <button
            className={s.loginButton}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Cerrar sesión <Icon name="logout" size={18} />
          </button>
        ) : (
          <>
            {typeof router.query.error === "string" && (
              <p role="alert" className={s.error}>
                No pudimos iniciar tu sesión. Inténtalo de nuevo o continúa en
                la vista de prueba.
              </p>
            )}
            {providerError ? (
              <p role="alert">
                No se pudieron cargar las opciones de acceso. Cierra esta
                ventana e inténtalo de nuevo.
              </p>
            ) : providers === null ? (
              <p role="status">Cargando opciones de acceso…</p>
            ) : providers.length === 0 ? (
              <p>
                El inicio de sesión aún no está disponible. Puedes continuar
                explorando la vista de prueba.
              </p>
            ) : null}
            {providers?.includes("google") && (
              <button
                className={s.loginButton}
                onClick={() => signIn("google", { callbackUrl: "/" })}
              >
                <span>G</span> Continuar con Google{" "}
                <Icon name="arrow" size={18} />
              </button>
            )}
            {providers?.includes("github") && (
              <button
                className={s.loginButton}
                onClick={() => signIn("github", { callbackUrl: "/" })}
              >
                <Icon name="grid" size={18} /> Continuar con GitHub{" "}
                <Icon name="arrow" size={18} />
              </button>
            )}
            <small>Los eventos de prueba permanecen en este navegador.</small>
          </>
        )}
      </dialog>
    </div>
  );
}

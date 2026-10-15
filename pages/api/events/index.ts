import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import dbConnect from "lib/dbConnect";
import Event from "models/event";
import Calendar from "models/calendar";
import { defaultCalendars, validEvent } from "lib/calendar";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (req.method !== "GET") {
    // Reject browser cross-origin writes as these endpoints authenticate with cookies.
    const origin = req.headers.origin;
    if (origin && origin !== process.env.NEXTAUTH_URL?.replace(/\/$/, "")) {
      return res.status(403).json({ error: "Origen no permitido." });
    }
  }
  try {
    const token = await getToken({ req, secret: process.env.NEXT_AUTH_SECRET });
    if (!token?.email)
      return res
        .status(401)
        .json({ error: "Inicia sesión para acceder a tus reservas." });
    const owner = token.email;
    if (
      req.method === "POST" &&
      !validEvent(req.body)
    ) {
      return res
        .status(400)
        .json({ error: "Revisa el nombre, la fecha y las horas de la reserva." });
    }
    await dbConnect();
    if (req.method === "POST" &&
      !defaultCalendars.some((c) => c.id === req.body.category) &&
      !(await Calendar.exists({ owner, calendarId: req.body.category }))) {
      return res.status(400).json({ error: "Elige uno de tus calendarios." });
    }
    const serialize = (event: any) => ({
      id: event._id.toString(),
      title: event.title,
      date: event.date,
      start: event.start,
      end: event.end,
      location: event.location,
      description: event.description,
      category: event.category,
      color: event.color || "",
    });
    if (req.method === "GET") {
      const events = await Event.find({ owner })
        .sort({ date: 1, start: 1 })
        .lean();
      return res.status(200).json(events.map(serialize));
    }
    const { title, date, start, end, location, description, category, color } =
      req.body;
    const data = {
      title: title.trim(),
      date,
      start,
      end,
      location: location.trim(),
      description: description.trim(),
      category,
      color: color || "",
    };
    const event = await Event.create({ ...data, owner });
    return res.status(201).json(serialize(event));
  } catch {
    return res
      .status(503)
      .json({
        error: "No pudimos conectar con tu calendario. Inténtalo de nuevo.",
      });
  }
}

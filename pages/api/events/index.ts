import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import mongoose from "mongoose";
import dbConnect from "lib/dbConnect";
import Event from "models/event";
import Calendar from "models/calendar";
import { defaultCalendars, validEvent } from "lib/calendar";
import { canManageReservations, PUBLIC_RESERVATION_OWNER } from "lib/calendarPermissions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const origin = req.headers.origin;
  if (req.method !== "GET" && origin && origin !== process.env.NEXTAUTH_URL?.replace(/\/$/, "")) {
    return res.status(403).json({ error: "Origen no permitido." });
  }
  try {
    const token = await getToken({ req, secret: process.env.NEXT_AUTH_SECRET });
    const admin = canManageReservations(token);
    if (req.method === "DELETE" && !admin) {
      return res.status(token?.email ? 403 : 401).json({ error: "Solo el administrador puede eliminar reservas." });
    }
    if ((req.method === "PUT" || req.method === "DELETE") &&
      (typeof req.body?.id !== "string" || !mongoose.isValidObjectId(req.body.id))) {
      return res.status(400).json({ error: "La reserva no es válida." });
    }
    if ((req.method === "POST" || req.method === "PUT") && !validEvent(req.body)) {
      return res.status(400).json({ error: "Revisa el nombre, la fecha y las horas de la reserva." });
    }
    await dbConnect();
    const serialize = (event: any) => ({
      id: event._id.toString(), title: event.title, date: event.date,
      start: event.start, end: event.end, location: event.location,
      description: event.description, category: event.category, color: event.color || "",
      ...(admin ? { owner: event.owner } : {}),
    });
    if (req.method === "GET") {
      const events = await Event.find({}).sort({ date: 1, start: 1 }).lean();
      return res.status(200).json(events.map(serialize));
    }
    if (req.method === "DELETE") {
      const result = await Event.deleteOne({ _id: req.body.id });
      return result.deletedCount ? res.status(204).end() : res.status(404).json({ error: "Reserva no encontrada." });
    }
    // Public edits preserve the original creator; the client cannot reassign ownership.
    const existing = req.method === "PUT" ? await Event.findOne({ _id: req.body.id }).lean() : null;
    if (req.method === "PUT" && !existing) return res.status(404).json({ error: "Reserva no encontrada." });
    const owner = existing ? existing.owner : admin ? token!.email : PUBLIC_RESERVATION_OWNER;
    if (!defaultCalendars.some((c) => c.id === req.body.category) &&
      !(await Calendar.exists({ owner, calendarId: req.body.category }))) {
      return res.status(400).json({ error: "El calendario no pertenece al creador de la reserva." });
    }
    const { title, date, start, end, location, description, category, color } = req.body;
    const data = { title: title.trim(), date, start, end, location: location.trim(),
      description: description.trim(), category, color: color || "" };
    const event = req.method === "POST"
      ? await Event.create({ ...data, owner })
      : await Event.findOneAndUpdate({ _id: req.body.id, owner }, { $set: data }, { new: true, runValidators: true });
    return event ? res.status(req.method === "POST" ? 201 : 200).json(serialize(event))
      : res.status(404).json({ error: "Reserva no encontrada." });
  } catch {
    return res.status(503).json({ error: "No pudimos conectar con tu calendario. Inténtalo de nuevo." });
  }
}

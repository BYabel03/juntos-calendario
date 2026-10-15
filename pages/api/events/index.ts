import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import mongoose from "mongoose";
import dbConnect from "lib/dbConnect";
import Event from "models/event";
import { validEvent } from "lib/calendar";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST, PUT, DELETE");
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
        .json({ error: "Inicia sesión para acceder a tus eventos." });
    const owner = token.email;
    if (
      req.method !== "GET" &&
      req.method !== "POST" &&
      (typeof req.body?.id !== "string" ||
        !mongoose.isValidObjectId(req.body.id))
    ) {
      return res.status(400).json({ error: "El evento no es válido." });
    }
    if (
      (req.method === "POST" || req.method === "PUT") &&
      !validEvent(req.body)
    ) {
      return res
        .status(400)
        .json({ error: "Revisa el título, la fecha y las horas del evento." });
    }
    await dbConnect();
    const serialize = (event: any) => ({
      id: event._id.toString(),
      title: event.title,
      date: event.date,
      start: event.start,
      end: event.end,
      location: event.location,
      description: event.description,
      category: event.category,
    });
    if (req.method === "GET") {
      const events = await Event.find({ owner })
        .sort({ date: 1, start: 1 })
        .lean();
      return res.status(200).json(events.map(serialize));
    }
    if (req.method === "DELETE") {
      const result = await Event.deleteOne({ _id: req.body.id, owner });
      return result.deletedCount
        ? res.status(204).end()
        : res.status(404).json({ error: "Evento no encontrado." });
    }
    const { title, date, start, end, location, description, category } =
      req.body;
    const data = {
      title: title.trim(),
      date,
      start,
      end,
      location: location.trim(),
      description: description.trim(),
      category,
    };
    const event =
      req.method === "POST"
        ? await Event.create({ ...data, owner })
        : await Event.findOneAndUpdate({ _id: req.body.id, owner }, data, {
            new: true,
            runValidators: true,
          });
    return event
      ? res.status(req.method === "POST" ? 201 : 200).json(serialize(event))
      : res.status(404).json({ error: "Evento no encontrado." });
  } catch {
    return res
      .status(503)
      .json({
        error: "No pudimos conectar con tu calendario. Inténtalo de nuevo.",
      });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import dbConnect from "lib/dbConnect";
import Calendar from "models/calendar";
import { mergeCalendars, validCalendar } from "lib/calendar";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "PUT"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const origin = req.headers.origin;
  if (req.method !== "GET" && origin && origin !== process.env.NEXTAUTH_URL?.replace(/\/$/, "")) {
    return res.status(403).json({ error: "Origen no permitido." });
  }
  try {
    const token = await getToken({ req, secret: process.env.NEXT_AUTH_SECRET });
    if (!token?.email) return res.status(401).json({ error: "Inicia sesión para acceder a tus calendarios." });
    if (req.method === "PUT" && !validCalendar(req.body)) {
      return res.status(400).json({ error: "Escribe un nombre de hasta 60 caracteres y elige un color válido." });
    }
    const owner = token.email;
    await dbConnect();
    if (req.method === "GET") {
      const saved = await Calendar.find({ owner }).lean();
      return res.status(200).json(mergeCalendars(saved.map((c: any) => ({ id: c.calendarId, label: c.label, color: c.color }))));
    }
    const { id, label, color } = req.body;
    const saved = await Calendar.findOneAndUpdate(
      { owner, calendarId: id },
      { $set: { label: label.trim(), color } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ id: saved.calendarId, label: saved.label, color: saved.color });
  } catch {
    return res.status(503).json({ error: "No pudimos guardar tus calendarios. Inténtalo de nuevo." });
  }
}

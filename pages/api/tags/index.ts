import type { NextApiRequest, NextApiResponse } from "next";

import { search, create } from "controllers/tags";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;
  const { name } = req.query;
  if ((method === "POST" || method === "GET") && typeof name !== "string") {
    return res.status(400).json({ message: "Invalid name" });
  }
  if (method === "POST" && typeof name === "string") {
    const [tag, error] = await create(name);
    if (error || !tag) {
      return res.status(500).json({ error });
    }
    return res.status(200).json(tag);
  }
  if (method === "GET" && typeof name === "string") {
    const [tags, error] = await search(name);
    if (error || !tags) {
      return res.status(500).json({ error });
    }
    return res.status(200).json(tags);
  }
}

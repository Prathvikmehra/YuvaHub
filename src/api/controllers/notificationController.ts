import { Request, Response } from "express";
import { dbCommand, dbQuery } from "../db.js";
import { safeObjectId } from "../../lib/utils.js";
import { AppError } from "../../lib/AppError.js";
import { parsePagination, paginate } from "../../lib/pagination.js";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!dbQuery) return res.status(503).json({ error: "Database not available" });

    const { page, limit, skip } = parsePagination(req.query);
    const collection = dbQuery.collection("notifications");
    let items;
    let total = 0;

    if ((dbQuery as any).isMock) {
      items = (collection as any).data ? (collection as any).data.filter((n: any) => n.userId === user.uid || n.userId === "global-subscribers") : [];
      total = items.length;
      items = items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(skip, skip + limit);
    } else {
      const filter = {
        $or: [
          { userId: user.uid },
          { userId: "global-subscribers" }
        ]
      };
      [items, total] = await Promise.all([
        collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        collection.countDocuments(filter)
      ]);
    }

    const formatted = items.map((item: any) => {
      const copy = { ...item, id: item._id?.toString() || item.id || "welcome" };
      delete copy._id;

      const elapsedMs = Date.now() - new Date(copy.createdAt).getTime();
      const elapsedMins = Math.floor(elapsedMs / 60000);
      if (elapsedMins < 1) copy.time = "Just now";
      else if (elapsedMins < 60) copy.time = `${elapsedMins}m ago`;
      else {
        const elapsedHrs = Math.floor(elapsedMins / 60);
        if (elapsedHrs < 24) copy.time = `${elapsedHrs}h ago`;
        else copy.time = new Date(copy.createdAt).toLocaleDateString();
      }

      return copy;
    });

    res.json(paginate(formatted, page, limit, total));
  } catch (err: any) {
    console.error("GET /api/v1/notifications error:", err);
    res.json([
      {
        id: "welcome",
        title: "Welcome to YuvaHub! ✨",
        message: "Ready to find your next break? The real data pipeline is active.",
        type: "welcome",
        time: "Just now",
        read: false
      }
    ]);
  }
};

export const markRead = async (req: Request, res: Response) => {
  const user = req.user;
  const rawNotifId = req.params.id;
  const id = Array.isArray(rawNotifId) ? rawNotifId[0] : rawNotifId;
  if (!dbCommand) throw AppError.serviceUnavailable("Database not available");

  const collection = dbCommand.collection("notifications");
  const oid = safeObjectId(id);
  const queryId = oid || id;

  if ((dbCommand as any).isMock) {
    const notif = (collection as any).data ? (collection as any).data.find((n: any) => n.id === id || n._id?.toString() === id) : null;
    if (notif) notif.read = true;
  } else {
    await collection.updateOne(
      { _id: queryId, userId: user.uid },
      { $set: { read: true } }
    );
  }

  res.json({ success: true });
};

export const markAllRead = async (req: Request, res: Response) => {
  const user = req.user;
  if (!dbCommand) throw AppError.serviceUnavailable("Database not available");

  const collection = dbCommand.collection("notifications");

  if ((dbCommand as any).isMock) {
    if ((collection as any).data) {
      (collection as any).data.forEach((n: any) => {
        if (n.userId === user.uid) n.read = true;
      });
    }
  } else {
    await collection.updateMany(
      { userId: user.uid },
      { $set: { read: true } }
    );
  }

  res.json({ success: true });
};

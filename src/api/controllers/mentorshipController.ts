import { Request, Response } from "express";
import { dbCommand, dbQuery } from "../db.js";
import { AppError } from "../../lib/AppError.js";

export const getMentorAvailability = async (req: Request, res: Response) => {
  const mentorUid = (req.query.mentorUid as string) || "mentor_default";
  if (dbQuery) {
    const avail = await dbQuery.collection("mentor_availability").findOne({ mentorUid });
    if (avail) return res.json(avail);
  }

  res.json({
    mentorUid,
    timezone: "IST (UTC+5:30)",
    maxSessionsPerWeek: 5,
    availableSlots: [
      { date: "2026-07-25", time: "10:00 AM" },
      { date: "2026-07-25", time: "02:00 PM" },
      { date: "2026-07-26", time: "05:00 PM" },
      { date: "2026-07-27", time: "11:00 AM" },
      { date: "2026-07-28", time: "04:00 PM" }
    ]
  });
};

export const bookSession = async (req: Request, res: Response) => {
  const { mentorUid, mentorName, topic, slotDateTime, meetingUrl } = req.body;
  const studentUid = req.user?.uid || req.body.studentUid;
  if (!studentUid || !mentorUid || !slotDateTime) {
    throw AppError.badRequest("Missing required booking details (studentUid, mentorUid, slotDateTime)");
  }

  if (dbQuery) {
    const existingSession = await dbQuery.collection("mentorship_sessions").findOne({
      mentorUid, slotDateTime, status: { $in: ["Pending", "Confirmed"] }
    });
    if (existingSession) {
      throw AppError.conflict("This time slot is already booked. Please select another slot.");
    }
  }

  const newSession = {
    sessionId: "sess_" + Date.now(),
    studentUid, mentorUid,
    mentorName: mentorName || "YuvaHub Industry Mentor",
    topic: topic || "Career Strategy & Resume Review",
    slotDateTime,
    meetingUrl: meetingUrl || `https://meet.jit.si/yuvahub-mentorship-${Date.now()}`,
    status: "Confirmed",
    createdAt: new Date()
  };

  if (dbCommand) {
    await dbCommand.collection("mentorship_sessions").insertOne(newSession);
  }

  res.status(201).json({ success: true, session: newSession });
};

export const getSessions = async (req: Request, res: Response) => {
  const uid = (req.query.uid as string) || "user_default";
  if (dbQuery) {
    const sessions = await dbQuery.collection("mentorship_sessions").find({
      $or: [{ studentUid: uid }, { mentorUid: uid }]
    }).sort({ createdAt: -1 }).toArray();

    return res.json(sessions);
  }

  res.json([{
    sessionId: "sess_demo_1",
    studentUid: uid,
    mentorUid: "m_sarah",
    mentorName: "Sarah Jenkins (Senior SWE @ Google)",
    topic: "GSoC Proposal & System Design Review",
    slotDateTime: "2026-07-25 at 10:00 AM IST",
    meetingUrl: "https://meet.jit.si/yuvahub-mentorship-gsoc",
    status: "Confirmed",
    createdAt: new Date().toISOString()
  }]);
};

export const updateSessionStatus = async (req: Request, res: Response) => {
  const { sessionId, status } = req.body;
  if (!sessionId || !status) {
    throw AppError.badRequest("Missing sessionId or status");
  }

  if (dbCommand) {
    await dbCommand.collection("mentorship_sessions").updateOne(
      { sessionId },
      { $set: { status, updatedAt: new Date() } }
    );
  }

  res.json({ success: true, sessionId, status });
};

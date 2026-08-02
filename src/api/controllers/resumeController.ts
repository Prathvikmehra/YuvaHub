import { Request, Response } from "express";
import { dbCommand, dbQuery } from "../db.js";
import { safeObjectId } from "../../lib/utils.js";
import { AppError } from "../../lib/AppError.js";
import { parsePagination, paginate } from "../../lib/pagination.js";

export const handleListResumes = async (req: any, res: any) => {
  const user = req.user;
  if (!user || !user.uid) throw AppError.unauthorized("Unauthorized");
  if (!dbQuery) throw AppError.serviceUnavailable("Database unavailable");

  const { page, limit, skip } = parsePagination(req.query);
  const resumesCol = dbQuery.collection("resumes");
  const filter = { userId: user.uid };
  const [list, total] = await Promise.all([
    resumesCol.find(filter).sort({ isDefault: -1, uploadedAt: -1 }).skip(skip).limit(limit).toArray(),
    resumesCol.countDocuments(filter)
  ]);
  const formatted = list.map((r: any) => ({ ...r, id: r._id.toString() }));
  res.json(paginate(formatted, page, limit, total));
};

export const handleCreateResume = async (req: any, res: any) => {
  const user = req.user;
  if (!user || !user.uid) throw AppError.unauthorized("Unauthorized");
  if (!dbCommand) throw AppError.serviceUnavailable("Database unavailable");

  const { displayName, originalFileName, fileUrl, publicId } = req.body || {};
  if (!fileUrl) {
    throw AppError.badRequest("Missing required fileUrl");
  }

  const resumesCol = dbCommand.collection("resumes");
  const usersCol = dbCommand.collection("users");

  const existingCount = await resumesCol.countDocuments({ userId: user.uid });
  const isDefault = existingCount === 0 || req.body.isDefault === true;

  if (isDefault) {
    await resumesCol.updateMany({ userId: user.uid }, { $set: { isDefault: false } });
  }

  const now = new Date();
  const newResume = {
    userId: user.uid,
    displayName: (displayName && displayName.trim()) || (originalFileName && originalFileName.trim()) || "Untitled Resume",
    originalFileName: (originalFileName && originalFileName.trim()) || "resume.pdf",
    fileUrl,
    publicId: publicId || "",
    uploadedAt: now,
    updatedAt: now,
    isDefault
  };

  const result = await resumesCol.insertOne(newResume);
  const insertedId = result.insertedId.toString();

  if (isDefault) {
    await usersCol.updateOne(
      { uid: user.uid },
      { $set: { resumeUrl: fileUrl, resumePublicId: publicId || "", updatedAt: now } }
    );
  }

  res.status(201).json({ status: "success", resume: { ...newResume, id: insertedId } });
};

export const handleRenameResume = async (req: any, res: any) => {
  const user = req.user;
  if (!user || !user.uid) throw AppError.unauthorized("Unauthorized");
  if (!dbCommand) throw AppError.serviceUnavailable("Database unavailable");

  const { id } = req.params;
  const { displayName } = req.body || {};

  if (!displayName || !displayName.trim()) {
    throw AppError.badRequest("displayName is required");
  }

  const resumesCol = dbCommand.collection("resumes");
  const oid = safeObjectId(id);
  const query = oid
    ? { _id: oid, userId: user.uid }
    : { _id: id, userId: user.uid };

  const target = await resumesCol.findOne(query);
  if (!target) {
    throw AppError.notFound("Resume not found or unauthorized");
  }

  const now = new Date();
  await resumesCol.updateOne(query, { $set: { displayName: displayName.trim(), updatedAt: now } });

  const updated = await resumesCol.findOne(query);
  res.json({ status: "success", resume: { ...updated, id: updated._id.toString() } });
};

export const handleDeleteResume = async (req: any, res: any) => {
  const user = req.user;
  if (!user || !user.uid) throw AppError.unauthorized("Unauthorized");
  if (!dbCommand) throw AppError.serviceUnavailable("Database unavailable");

  const { id } = req.params;
  const resumesCol = dbCommand.collection("resumes");
  const usersCol = dbCommand.collection("users");

  const oid = safeObjectId(id);
  const query = oid
    ? { _id: oid, userId: user.uid }
    : { _id: id, userId: user.uid };

  const target = await resumesCol.findOne(query);
  if (!target) {
    throw AppError.notFound("Resume not found or unauthorized");
  }

  await resumesCol.deleteOne(query);

  if (target.isDefault) {
    const remaining = await resumesCol.find({ userId: user.uid }).sort({ updatedAt: -1, uploadedAt: -1 }).toArray();
    if (remaining.length > 0) {
      const nextDefault = remaining[0];
      await resumesCol.updateOne({ _id: nextDefault._id }, { $set: { isDefault: true, updatedAt: new Date() } });
      await usersCol.updateOne({ uid: user.uid }, { $set: { resumeUrl: nextDefault.fileUrl, resumePublicId: nextDefault.publicId || "", updatedAt: new Date() } });
    } else {
      await usersCol.updateOne({ uid: user.uid }, { $set: { resumeUrl: "", resumePublicId: "", updatedAt: new Date() } });
    }
  }

  res.json({ status: "success", message: "Resume deleted successfully" });
};

export const handleSetDefaultResume = async (req: any, res: any) => {
  const user = req.user;
  if (!user || !user.uid) throw AppError.unauthorized("Unauthorized");
  if (!dbCommand) throw AppError.serviceUnavailable("Database unavailable");

  const { id } = req.params;
  const resumesCol = dbCommand.collection("resumes");
  const usersCol = dbCommand.collection("users");

  const oid = safeObjectId(id);
  const query = oid
    ? { _id: oid, userId: user.uid }
    : { _id: id, userId: user.uid };

  const target = await resumesCol.findOne(query);
  if (!target) {
    throw AppError.notFound("Resume not found or unauthorized");
  }

  const now = new Date();
  await resumesCol.updateMany({ userId: user.uid }, { $set: { isDefault: false } });
  await resumesCol.updateOne(query, { $set: { isDefault: true, updatedAt: now } });

  await usersCol.updateOne({ uid: user.uid }, { $set: { resumeUrl: target.fileUrl, resumePublicId: target.publicId || "", updatedAt: now } });

  const updated = await resumesCol.findOne(query);
  res.json({ status: "success", resume: { ...updated, id: updated._id.toString() } });
};

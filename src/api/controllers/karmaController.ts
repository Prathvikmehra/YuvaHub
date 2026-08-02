import { Request, Response } from "express";
import { dbCommand, dbQuery } from "../db.js";
import { AppError } from "../../lib/AppError.js";

export const getKarmaBalance = async (req: Request, res: Response) => {
  const user = req.user;
  if (!dbQuery) throw AppError.serviceUnavailable("Database not available");
  const txs = await dbQuery.collection("transactions").find({ userId: user.uid }).toArray();
  let balance = txs.reduce((acc: number, tx: any) => acc + (tx.amount || 0), 0);

  if (balance === 0 && process.env.NODE_ENV === "development") {
    if (dbCommand) {
      await dbCommand.collection("transactions").insertOne({
        userId: user.uid,
        amount: 1000,
        type: 'debug_grant',
        timestamp: Date.now()
      });
      balance = 1000;
    }
  }

  res.json({ balance });
};

export const awardKarma = async (req: Request, res: Response) => {
  const user = req.user;
  if (!dbCommand) throw AppError.serviceUnavailable("Database not available");
  const { type, metadata } = req.body;
  let amount = 0;
  if (type === 'daily_login') amount = 10;
  else if (type === 'profile_setup') amount = 50;
  else if (type === 'expired_report') amount = 5;

  if (amount > 0) {
    if (type === 'daily_login') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const existing = await dbCommand.collection("transactions").findOne({
        userId: user.uid,
        type: 'daily_login',
        timestamp: { $gte: startOfDay.getTime() }
      });
      if (existing) throw AppError.badRequest("Daily login already claimed");
    }

    await dbCommand.collection("transactions").insertOne({
      userId: user.uid,
      amount,
      type,
      timestamp: Date.now(),
      metadata
    });
  }
  res.json({ success: true, awarded: amount });
};

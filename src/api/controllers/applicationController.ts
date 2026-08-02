import { Request, Response } from "express";
import { generateApplicationDraft } from "../../services/applicationGenerator.js";
import { addApplicationJob } from "../../queues/applicationQueue.js";
import { AppError } from "../../lib/AppError.js";

export const generateDraft = async (req: Request, res: Response) => {
  const { opportunity, profile } = req.body;

  if (!opportunity?.title) {
    throw AppError.badRequest("Opportunity details required");
  }

  const draft = await generateApplicationDraft({
    opportunityTitle: opportunity.title,
    organization: opportunity.organization || opportunity.org,
    profile
  });

  return res.json({ success: true, content: draft });
};

export const queueApplication = async (req: Request, res: Response) => {
  const job = await addApplicationJob({
    userId: req.body.userId,
    opportunityId: req.body.opportunityId,
    opportunityTitle: req.body.opportunityTitle,
    organization: req.body.organization,
    profile: req.body.profile,
    action: req.body.action || "generate_draft"
  });

  return res.json({ success: true, jobId: job.id });
};

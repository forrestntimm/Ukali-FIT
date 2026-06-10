import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err, path: req.path }, "Unhandled error");
  const status = err?.status || 500;
  const clientMessage = status >= 500 ? "Internal server error" : err?.message || "Request failed";
  const code = err?.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
  res.status(status).json({ code, message: clientMessage });
}

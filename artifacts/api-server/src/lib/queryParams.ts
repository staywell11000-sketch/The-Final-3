import { type Request } from "express";

export function getStringQuery(req: Request, param: string): string | undefined {
  const val = req.query[param];
  if (Array.isArray(val)) return val[0];
  return val as string | undefined;
}

export function getRequiredStringQuery(req: Request, param: string): string {
  const val = getStringQuery(req, param);
  if (!val) throw new Error(`Missing required query param: ${param}`);
  return val;
}

export function getStringArrayQuery(req: Request, param: string): string[] {
  const val = req.query[param];
  if (Array.isArray(val)) return val as string[];
  if (val) return [val as string];
  return [];
}

export function getIntQuery(req: Request, param: string): number | undefined {
  const val = getStringQuery(req, param);
  if (!val) return undefined;
  const num = parseInt(val, 10);
  return isNaN(num) ? undefined : num;
}
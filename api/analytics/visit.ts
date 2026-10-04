import type { ServerResponse } from "node:http";
import { obrotyty, type ZapitHTTP } from "../../server/server.ts";

export default function handler(
  req: ZapitHTTP,
  res: ServerResponse
): void {
  obrotyty(req, res, "/api/analytics/visit");
}

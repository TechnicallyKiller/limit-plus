import { callWorker } from "@/lib/worker";

export const dynamic = "force-dynamic";
export const GET = (req: Request) => callWorker(req, "/demo", { method: "GET" });

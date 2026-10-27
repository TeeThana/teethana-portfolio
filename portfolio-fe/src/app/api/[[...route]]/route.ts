import { createApi } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const app = createApi();
export const GET = (request: Request) => app.fetch(request);
export const POST = (request: Request) => app.fetch(request);
export const PATCH = (request: Request) => app.fetch(request);
export const DELETE = (request: Request) => app.fetch(request);

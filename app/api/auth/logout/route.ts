import { clearSessionCookie } from "../../../lib/auth";

export async function GET(request: Request) {
  return new Response(null, { status: 303, headers: { Location: new URL("/login", request.url).toString(), "Set-Cookie": clearSessionCookie() } });
}

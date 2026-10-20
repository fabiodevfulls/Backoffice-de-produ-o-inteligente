import { authenticate, createSessionCookie } from "../../../lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const authenticatedEmail = await authenticate(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!authenticatedEmail) return new Response("E-mail ou senha incorretos.", { status: 401 });
  return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": await createSessionCookie(authenticatedEmail) } });
}

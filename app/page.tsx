import Dashboard from "./dashboard";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionEmail } from "./lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const email = await sessionEmail(await headers());
  if (!email) redirect("/login");
  return (
    <Dashboard
      authUser={{ displayName: email, email }}
      accessToken="password-session"
    />
  );
}

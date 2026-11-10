import { headers } from "next/headers";
import { hasActiveDemoSession } from "../lib/demo-session";
import DemoAccessForm from "./demo-access-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acesso de demonstração", referrer: "no-referrer" as const };

export default async function DemoAccessPage() {
  const enabled = process.env.DEMO_ACCESS_ENABLED === "true";
  const hasDemoSession = enabled && await hasActiveDemoSession(await headers());
  return <DemoAccessForm enabled={enabled} hasDemoSession={hasDemoSession} />;
}

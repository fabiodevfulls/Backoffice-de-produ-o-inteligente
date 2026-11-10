import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DemoSupervision } from "../../dashboard";
import { hasActiveDemoSession } from "../../lib/demo-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supervisão de demonstração" };

export default async function DemoSupervisionPage() {
  if (!await hasActiveDemoSession(await headers())) redirect("/demo-access");
  return <DemoSupervision />;
}

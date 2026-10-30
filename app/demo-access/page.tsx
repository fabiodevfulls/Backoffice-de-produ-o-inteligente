import DemoAccessForm from "./demo-access-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acesso de demonstração", referrer: "no-referrer" as const };

export default function DemoAccessPage() {
  const enabled = process.env.DEMO_ACCESS_ENABLED === "true";
  return <DemoAccessForm enabled={enabled} />;
}

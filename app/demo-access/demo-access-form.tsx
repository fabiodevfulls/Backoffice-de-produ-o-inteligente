"use client";

import { useEffect, useState } from "react";

export default function DemoAccessForm({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState(enabled ? "Validando acesso..." : "O acesso de demonstração está indisponível.");
  const [error, setError] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", "/demo-access");
    let cancelled = false;
    void fetch("/api/demo-access/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const result = await response.json() as { error?: string; redirect?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível validar o QR Code.");
      if (!cancelled) window.location.replace(result.redirect || "/");
    }).catch((reason: unknown) => {
      if (cancelled) return;
      setError(true);
      setStatus(reason instanceof Error ? reason.message : "Não foi possível validar este acesso.");
    });
    return () => { cancelled = true; };
  }, [enabled]);

  return <main className="demo-access-page">
    <section className="demo-access-message" aria-live="polite">
      <p className="eyebrow">BACKOFFICE • DEMONSTRAÇÃO</p>
      <h1>{error ? "Acesso não disponível" : "Preparando sua demonstração"}</h1>
      <p>{status}</p>
      <small>Acesso válido até 12 de novembro de 2026. Cada sessão dura até 1 hora.</small>
    </section>
  </main>;
}

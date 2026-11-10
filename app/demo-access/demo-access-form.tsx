"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function DemoAccessForm({ enabled, hasDemoSession }: { enabled: boolean; hasDemoSession: boolean }) {
  const [status, setStatus] = useState(enabled ? "Validando acesso..." : "O acesso de demonstração está indisponível.");
  const [error, setError] = useState(!enabled);
  const [ready, setReady] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const token = tokenRef.current ?? window.location.hash.slice(1);
    tokenRef.current = token;
    if (!token && hasDemoSession) {
      const timer = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(timer);
    }
    window.history.replaceState(null, "", "/demo-access");
    let cancelled = false;
    void fetch("/api/demo-access/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível validar o QR Code.");
      if (!cancelled) setReady(true);
    }).catch((reason: unknown) => {
      if (cancelled) return;
      setError(true);
      setStatus(reason instanceof Error ? reason.message : "Não foi possível validar este acesso.");
    });
    return () => { cancelled = true; };
  }, [enabled, hasDemoSession]);

  return <main className="demo-access-page">
    <section className="demo-access-message" aria-live="polite">
      <p className="eyebrow">BACKOFFICE • DEMONSTRAÇÃO</p>
      <h1>{ready ? "Qual área você quer testar?" : error ? "Acesso não disponível" : "Preparando sua demonstração"}</h1>
      {ready ? <>
        <p>Teste a rotina de atendimento ou veja a produção de uma equipe fictícia na Supervisão.</p>
        <div className="demo-access-actions">
          <Link className="secondary-button" href="/">Atendimento</Link>
          <Link className="secondary-button" href="/demo-access/supervision">Supervisão</Link>
        </div>
      </> : <p>{status}</p>}
      <small>Acesso válido até 12 de novembro de 2026. Cada sessão dura até 1 hora.</small>
    </section>
  </main>;
}

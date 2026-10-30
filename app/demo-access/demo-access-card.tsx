"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useState } from "react";

type DemoAccessResult = { url: string; expiresAt: string };

export default function DemoAccessCard() {
  const [access, setAccess] = useState<DemoAccessResult | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");

  async function generate() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/demo-access", { method: "POST", cache: "no-store" });
      const result = await response.json() as DemoAccessResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível gerar o QR Code.");
      const dataUrl = await QRCode.toDataURL(result.url, {
        errorCorrectionLevel: "M", margin: 2, width: 280,
        color: { dark: "#06131f", light: "#ffffff" },
      });
      setAccess(result);
      setQr(dataUrl);
      setNotice("QR Code pronto para apresentação.");
      setNoticeType("success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível gerar o QR Code.");
      setNoticeType("error");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!access) return;
    try {
      await navigator.clipboard.writeText(access.url);
      setNotice("Link copiado.");
      setNoticeType("success");
    } catch {
      setNotice("Não foi possível copiar. Use o botão de baixar o QR Code.");
      setNoticeType("error");
    }
  }

  return <section className="panel demo-access-card">
    <div className="section-heading">
      <div><p className="eyebrow">ACESSO PARA APRESENTAÇÃO</p><h2>Acesso de teste por QR Code</h2>
        <p>QR Code reutilizável até 12 de novembro de 2026. Cada sessão expira em 1 hora; os dados de demonstração ficam fora dos relatórios reais.</p></div>
      <span className="permission-tag">Somente Admin</span>
    </div>
    <div className="demo-access-controls">
      <button className="primary-button" type="button" onClick={() => void generate()} disabled={busy}>
        {busy ? "Gerando QR Code..." : access ? "Gerar outro QR Code" : "Gerar QR Code de teste"}
      </button>
      {access ? <span>Validade do QR Code: até 12/11/2026</span> : null}
    </div>
    {qr ? <div className="demo-access-result">
      {/* Generated locally so the bearer link is never sent to an external QR service. */}
      <Image src={qr} width={220} height={220} unoptimized alt="QR Code de acesso de demonstração" />
      <div><strong>Aponte a câmera para entrar</strong><p>O acesso abre o sistema sem pedir login. A sessão encerra automaticamente após 1 hora.</p>
        <div className="demo-access-actions"><button className="secondary-button" type="button" onClick={() => void copyLink()}>Copiar link</button>
          <a className="secondary-button" href={qr} download="qrcode-acesso-demo.png">Baixar QR Code</a></div>
      </div>
    </div> : null}
    {notice ? <p className={`form-status ${noticeType}`} role="status">{notice}</p> : null}
  </section>;
}

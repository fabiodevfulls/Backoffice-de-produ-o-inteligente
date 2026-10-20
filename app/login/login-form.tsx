"use client";

import { FormEvent, useState } from "react";
import styles from "./styles.module.css";

type Mode = "login" | "register";

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setStatus("As senhas não são iguais.");
      return;
    }
    setSaving(true);
    setStatus("");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "request-code", name: form.get("name"),
        employeeCode: form.get("employeeCode"), email, password }),
    });
    const result = await response.json() as { message?: string; error?: string };
    setSaving(false);
    setStatus(result.message ?? result.error ?? "Não foi possível enviar o código.");
    if (response.ok) setPendingEmail(email);
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setStatus("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm-code", email: pendingEmail, code: form.get("code") }),
    });
    const result = await response.json() as { message?: string; error?: string };
    setSaving(false);
    setStatus(result.message ?? result.error ?? "Não foi possível validar o código.");
    if (response.ok) { setPendingEmail(""); setMode("login"); }
  }

  return (
    <section className={styles.card}>
      <div className={styles.brand}>BACKOFFICE PRODUÇÃO</div>
      <div>
        <h1>Backoffice Produção</h1>
        <p>{mode === "login" ? "Acesse sua área de trabalho." : "Crie seu acesso individual de atendente."}</p>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Acesso ao sistema">
        <button type="button" className={mode === "login" ? styles.activeTab : ""} onClick={() => { setMode("login"); setPendingEmail(""); setStatus(""); }}>Entrar</button>
        <button type="button" className={mode === "register" ? styles.activeTab : ""} onClick={() => { setMode("register"); setPendingEmail(""); setStatus(""); }}>Criar cadastro</button>
      </div>
      {status ? <div className={styles.status} role="status">{status}</div> : null}
      {mode === "login" ? (
        <form className={styles.form} action="/api/auth/login" method="post">
          <label>E-mail<input name="email" type="email" autoComplete="username" required /></label>
          <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className={styles.primary} type="submit">Entrar</button>
        </form>
      ) : pendingEmail ? (
        <form className={styles.form} onSubmit={confirmCode}>
          <div className={styles.emailNotice}>Código enviado para {pendingEmail}</div>
          <label>Código de validação<input name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required /></label>
          <small>Digite os 6 números recebidos. O código expira em 10 minutos.</small>
          <button className={styles.primary} type="submit" disabled={saving}>{saving ? "Validando..." : "Validar e criar cadastro"}</button>
          <button className={styles.secondary} type="button" onClick={() => { setPendingEmail(""); setStatus(""); }}>Corrigir dados ou reenviar</button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={register}>
          <label>Nome completo<input name="name" minLength={3} maxLength={120} autoComplete="name" required /></label>
          <label>Matrícula<input name="employeeCode" minLength={2} maxLength={40} required /></label>
          <label>E-mail corporativo<input name="email" type="email" placeholder="nome@equatorialservicos.com.br" autoComplete="email" required /></label>
          <label>Senha<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label>
          <label>Confirmar senha<input name="confirmPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label>
          <small>Permitido somente e-mail @equatorialservicos.com.br.</small>
          <small>Enviaremos um código de validação para confirmar que o e-mail existe.</small>
          <button className={styles.primary} type="submit" disabled={saving}>{saving ? "Enviando código..." : "Enviar código de validação"}</button>
        </form>
      )}
    </section>
  );
}

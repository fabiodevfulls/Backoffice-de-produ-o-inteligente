"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Dashboard from "./dashboard";

type Mode = "login" | "signup" | "forgot";

export default function AuthPortal({
  authConfig,
}: {
  authConfig: { url: string; publishableKey: string };
}) {
  const supabase = useMemo(
    () => createClient(authConfig.url, authConfig.publishableKey),
    [authConfig.publishableKey, authConfig.url],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>("login");
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setChecking(false);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (checking) {
    return <main className="login-shell"><div className="auth-loading">Carregando acesso seguro...</div></main>;
  }

  if (session && recoveryMode) {
    return <NewPasswordForm onSave={async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setRecoveryMode(false);
    }} />;
  }

  if (session) {
    const metadata = session.user.user_metadata ?? {};
    return (
      <Dashboard
        authUser={{
          displayName: String(metadata.full_name || session.user.email || "Atendente"),
          email: session.user.email || "",
        }}
        accessToken={session.access_token}
        onSignOut={async () => { await supabase.auth.signOut(); }}
      />
    );
  }

  return (
    <AuthForm
      mode={mode}
      setMode={setMode}
      onLogin={async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }}
      onSignup={async ({ email, password, fullName, employeeCode }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, employee_code: employeeCode },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        return Boolean(data.session);
      }}
      onForgot={async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
      }}
    />
  );
}

function AuthForm({ mode, setMode, onLogin, onSignup, onForgot }: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (values: { email: string; password: string; fullName: string; employeeCode: string }) => Promise<boolean>;
  onForgot: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "saving", message: "Aguarde..." });
    try {
      if (mode === "login") {
        await onLogin(email, password);
      } else if (mode === "signup") {
        const signedIn = await onSignup({ email, password, fullName, employeeCode });
        if (!signedIn) {
          setStatus({ type: "success", message: "Cadastro criado. Confira seu e-mail para confirmar a conta." });
        }
      } else {
        await onForgot(email);
        setStatus({ type: "success", message: "Enviamos o link para redefinir sua senha." });
      }
    } catch (error) {
      setStatus({ type: "error", message: translateAuthError(error) });
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setStatus({ type: "idle", message: "" });
  }

  return (
    <main className="login-shell">
      <section className="login-panel auth-panel" aria-labelledby="auth-title">
        <div className="login-mark">BP</div>
        <p className="eyebrow">CONTROLE DE PRODUTIVIDADE</p>
        <h1 id="auth-title">{mode === "signup" ? "Crie sua conta de atendente" : mode === "forgot" ? "Recupere sua senha" : "Entre na plataforma"}</h1>
        <p>{mode === "signup" ? "Cadastre-se com seus dados profissionais. Você verá somente seus próprios resultados." : mode === "forgot" ? "Informe seu e-mail para receber o link de recuperação." : "Use o e-mail e a senha cadastrados no sistema."}</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" ? <>
            <label className="field"><span>Nome completo</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={3} maxLength={120} required /></label>
            <label className="field"><span>Matrícula ou identificação</span><input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} minLength={2} maxLength={40} required /></label>
          </> : null}
          <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          {mode !== "forgot" ? <label className="field"><span>Senha</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label> : null}
          <button className="primary-button" type="submit" disabled={status.type === "saving"}>{status.type === "saving" ? "Aguarde..." : mode === "signup" ? "Criar minha conta" : mode === "forgot" ? "Enviar recuperação" : "Entrar"}</button>
          {status.message ? <p className={`form-status ${status.type}`}>{status.message}</p> : null}
        </form>
        <div className="auth-links">
          {mode !== "login" ? <button type="button" onClick={() => changeMode("login")}>Já tenho uma conta</button> : <>
            <button type="button" onClick={() => changeMode("signup")}>Criar cadastro</button>
            <button type="button" onClick={() => changeMode("forgot")}>Esqueci minha senha</button>
          </>}
        </div>
      </section>
    </main>
  );
}

function NewPasswordForm({ onSave }: { onSave: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  return <main className="login-shell"><section className="login-panel auth-panel"><div className="login-mark">BP</div><h1>Crie uma nova senha</h1><form className="auth-form" onSubmit={async (event) => { event.preventDefault(); try { await onSave(password); } catch (error) { setMessage(translateAuthError(error)); } }}><label className="field"><span>Nova senha</span><input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="primary-button" type="submit">Salvar nova senha</button>{message ? <p className="form-status error">{message}</p> : null}</form></section></main>;
}

function translateAuthError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("already registered")) return "Este e-mail já possui cadastro.";
  if (message.includes("password")) return "A senha deve ter pelo menos 8 caracteres.";
  if (message.includes("email rate limit")) return "Aguarde alguns minutos antes de solicitar outro e-mail.";
  return "Não foi possível concluir. Confira os dados e tente novamente.";
}

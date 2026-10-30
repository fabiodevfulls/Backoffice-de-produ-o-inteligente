import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionEmail } from "../lib/auth";
import LoginForm from "./login-form";
import ParticleSphere from "./particle-sphere";
import styles from "./styles.module.css";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await sessionEmail(await headers())) redirect("/");
  return (
    <main className={styles.page}>
      <section className={styles.visual} aria-label="Esfera animada">
        <ParticleSphere />
      </section>
      <div className={styles.formArea}>
        <LoginForm />
      </div>
    </main>
  );
}

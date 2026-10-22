import { a as require_react, o as __toESM, t as require_jsx_runtime } from "../index.js";
//#region app/login/styles.module.css
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var styles_module_default = {
	page: "_page_bnd77_1",
	particleVisual: "_particleVisual_bnd77_3",
	particleImage: "_particleImage_bnd77_4",
	formArea: "_formArea_bnd77_6",
	card: "_card_bnd77_7",
	brand: "_brand_bnd77_8",
	form: "_form_bnd77_6",
	tabs: "_tabs_bnd77_16",
	activeTab: "_activeTab_bnd77_18",
	primary: "_primary_bnd77_19",
	secondary: "_secondary_bnd77_21",
	emailNotice: "_emailNotice_bnd77_22",
	status: "_status_bnd77_24"
};
//#endregion
//#region app/login/login-form.tsx
var import_jsx_runtime = require_jsx_runtime();
function LoginForm() {
	const [mode, setMode] = (0, import_react.useState)("login");
	const [status, setStatus] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [pendingEmail, setPendingEmail] = (0, import_react.useState)("");
	async function register(event) {
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
			body: JSON.stringify({
				action: "request-code",
				name: form.get("name"),
				employeeCode: form.get("employeeCode"),
				email,
				password
			})
		});
		const result = await response.json();
		setSaving(false);
		setStatus(result.message ?? result.error ?? "Não foi possível enviar o código.");
		if (response.ok) setPendingEmail(email);
	}
	async function confirmCode(event) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setSaving(true);
		setStatus("");
		const response = await fetch("/api/auth/register", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				action: "confirm-code",
				email: pendingEmail,
				code: form.get("code")
			})
		});
		const result = await response.json();
		setSaving(false);
		setStatus(result.message ?? result.error ?? "Não foi possível validar o código.");
		if (response.ok) {
			setPendingEmail("");
			setMode("login");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: styles_module_default.card,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: styles_module_default.brand,
				children: "BACKOFFICE PRODUÇÃO"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Backoffice Produção" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: mode === "login" ? "Acesse sua área de trabalho." : "Crie seu acesso individual de atendente." })] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: styles_module_default.tabs,
				role: "tablist",
				"aria-label": "Acesso ao sistema",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: mode === "login" ? styles_module_default.activeTab : "",
					onClick: () => {
						setMode("login");
						setPendingEmail("");
						setStatus("");
					},
					children: "Entrar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: mode === "register" ? styles_module_default.activeTab : "",
					onClick: () => {
						setMode("register");
						setPendingEmail("");
						setStatus("");
					},
					children: "Criar cadastro"
				})]
			}),
			status ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: styles_module_default.status,
				role: "status",
				children: status
			}) : null,
			mode === "login" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: styles_module_default.form,
				action: "/api/auth/login",
				method: "post",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["E-mail", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "email",
						type: "email",
						autoComplete: "username",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Senha", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "password",
						type: "password",
						autoComplete: "current-password",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: styles_module_default.primary,
						type: "submit",
						children: "Entrar"
					})
				]
			}) : pendingEmail ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: styles_module_default.form,
				onSubmit: confirmCode,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: styles_module_default.emailNotice,
						children: ["Código enviado para ", pendingEmail]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Código de validação", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "code",
						inputMode: "numeric",
						pattern: "[0-9]{6}",
						minLength: 6,
						maxLength: 6,
						autoComplete: "one-time-code",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Digite os 6 números recebidos. O código expira em 10 minutos." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: styles_module_default.primary,
						type: "submit",
						disabled: saving,
						children: saving ? "Validando..." : "Validar e criar cadastro"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: styles_module_default.secondary,
						type: "button",
						onClick: () => {
							setPendingEmail("");
							setStatus("");
						},
						children: "Corrigir dados ou reenviar"
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: styles_module_default.form,
				onSubmit: register,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Nome completo", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "name",
						minLength: 3,
						maxLength: 120,
						autoComplete: "name",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Matrícula", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "employeeCode",
						minLength: 2,
						maxLength: 40,
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["E-mail corporativo", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "email",
						type: "email",
						placeholder: "nome@equatorialservicos.com.br",
						autoComplete: "email",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Senha", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "password",
						type: "password",
						minLength: 8,
						maxLength: 128,
						autoComplete: "new-password",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Confirmar senha", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						name: "confirmPassword",
						type: "password",
						minLength: 8,
						maxLength: 128,
						autoComplete: "new-password",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Permitido somente e-mail @equatorialservicos.com.br." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Enviaremos um código de validação para confirmar que o e-mail existe." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: styles_module_default.primary,
						type: "submit",
						disabled: saving,
						children: saving ? "Enviando código..." : "Enviar código de validação"
					})
				]
			})
		]
	});
}
//#endregion
export { LoginForm as default };

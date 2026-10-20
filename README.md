# Controle Backoffice ARII

Sistema de produtividade para atendentes e supervisão, desenvolvido com Next.js/Vinext, Supabase Auth e Cloudflare D1.

## Funcionalidades

- cadastro e login dos atendentes;
- calculadora de produtividade;
- registro de protocolos e ligações;
- data, horário, quantidade, tipologia, status e link do Backoffice;
- relatório individual para cada atendente;
- painel geral da supervisão;
- recuperação de senha pelo Supabase.

## Requisitos

- VS Code;
- Node.js 22.13 ou superior;
- npm.

## Abrir e executar no VS Code

1. Extraia este arquivo ZIP.
2. No VS Code, escolha **Arquivo > Abrir Pasta** e selecione `controle-backoffice-arii`.
3. Abra o terminal integrado.
4. Instale as dependências:

   ```bash
   npm install
   ```

5. Duplique `.dev.vars.example`, renomeie a cópia para `.dev.vars` e preencha os três valores.
6. Inicie o sistema:

   ```bash
   npm run dev
   ```

7. Abra o endereço local exibido no terminal, normalmente `http://localhost:5173`.

## Variáveis necessárias

- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: chave pública/publishable do Supabase.
- `SUPERVISOR_EMAILS`: e-mail autorizado como supervisão. Para mais de um, separe por vírgulas.

Não publique `.dev.vars` e não coloque senhas no código.

## Estrutura principal

- `app/`: telas, autenticação, painel e APIs.
- `app/lib/server.ts`: regras de usuário, supervisão e banco.
- `worker/`: entrada do Cloudflare Worker.
- `drizzle/`: migrações do banco D1.
- `cloudflare-proxy/worker.js`: código do Worker usado no domínio `workers.dev` atual.

## Verificações

```bash
npm run lint
npm test
```

## Domínio atual

`https://controle-backoffice-arii.fabio-boy-2010-fs.workers.dev`

O arquivo `cloudflare-proxy/worker.js` mantém esse domínio ligado à implantação atual do sistema.

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

## Organização das pastas

- `app/`: páginas e rotas do sistema.
- `app/components/supervision/`: interface e estilos do painel da supervisão.
- `app/api/`: consultas e operações autenticadas.
- `app/lib/`: regras de produtividade, autenticação e acesso aos dados.
- `db/` e `drizzle/`: estrutura do banco e migrações.
- `infrastructure/cloudflare/proxy/`: proxy do domínio anterior.
- `worker/`: entrada da aplicação na Cloudflare.
- `docs/power-bi/`: instruções e consulta da integração com Power BI.
- `public/`: imagens, ícones e áudios.
- `tests/`: verificações automatizadas.
- `scripts/` e `build/`: preparação e validação da publicação.
- `examples/`: exemplos de integração preservados.

## Verificações

```bash
npm run lint
npm test
```

## Domínio atual

`https://controle-backoffice-arii.fabio-boy-2010-fs.workers.dev`

O arquivo `infrastructure/cloudflare/proxy/worker.js` mantém esse domínio ligado à implantação atual do sistema.

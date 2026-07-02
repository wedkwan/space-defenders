# Verificação de E-mail — Space Defenders Auth

Este guia explica como configurar e testar o fluxo de verificação de e-mail (cadastro local + Google OAuth) da API de autenticação.

## 1. Pré-requisitos

- Node.js instalado
- MySQL/MariaDB rodando em `localhost:3306`
- Banco `space_defenders` criado
- Uma conta no [Resend](https://resend.com) com API Key gerada

## 2. Configurar variáveis de ambiente

Na raiz de `apps/auth`, crie ou edite o arquivo `.env`:

```
RESEND_API_KEY=re_sua_chave_aqui
MAIL_FROM=onboarding@resend.dev
FRONTEND_URL=http://localhost:3000
JWT_SECRET=seu_jwt_secret_aqui
```

> **Importante:** se `MAIL_FROM` for `onboarding@resend.dev` (domínio de sandbox do Resend), o e-mail só é entregue para o endereço que é dono da conta Resend usada. Para enviar para qualquer e-mail, é preciso verificar um domínio próprio no painel do Resend.

## 3. Instalar dependências e preparar o banco

```bash
cd apps/auth
npm install
npx prisma generate
npx prisma migrate dev
```

## 4. Subir a aplicação

```bash
npm run start:dev
```

A API sobe em `http://localhost:3001`.

## 5. Testando o fluxo — cadastro local

### 5.1 Criar usuário local

```bash
curl -i -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Seu Nome","email":"seuemail@teste.com","password":"senha123","provider":"local"}'
```

**Esperado:**
- Status `201`
- Resposta com os dados do usuário, incluindo `"emailVerified": false`
- Um e-mail de verificação chega na caixa de entrada (ou spam) do endereço usado

### 5.2 Conferir o token gerado (opcional, via Prisma Studio)

```bash
npx prisma studio
```

Abra a tabela `VerificationToken`, filtre pelo `userId` do usuário criado e copie o valor do campo `token`.

### 5.3 Verificar o e-mail

Clique no link recebido por e-mail, ou rode manualmente:

```bash
curl "http://localhost:3001/auth/verify-email?token=TOKEN_COPIADO_AQUI"
```

**Esperado:**
```json
{"message":"E-mail verificado com sucesso"}
```

Depois disso, no Prisma Studio:
- `User.emailVerified` deve estar `true`
- A linha correspondente em `VerificationToken` deve ter sido removida

### 5.4 Reenviar e-mail de verificação

Crie um segundo usuário e, sem verificar o e-mail dele, teste o reenvio:

```bash
curl -i -X POST http://localhost:3001/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"outroemail@teste.com"}'
```

**Esperado:**
```json
{"message":"Se o e-mail existir, um novo link foi enviado"}
```

Um novo token deve substituir o anterior na tabela `VerificationToken`. Se o e-mail já estiver verificado, a resposta é um erro `409 Conflict`.

## 6. Testando o fluxo — login com Google

```bash
# Abra no navegador (não dá pra testar OAuth via curl)
http://localhost:3001/auth/google
```

Depois do login com Google, o usuário é criado automaticamente com:
- `provider: "google"`
- `emailVerified: true` (já vem verificado, sem necessidade de token)

## 7. Testando login local

```bash
curl -i -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seuemail@teste.com","password":"senha123"}'
```

**Esperado:** retorno com `access_token` e dados do usuário.

## 8. Checklist rápido de teste

- [ ] Cadastro local envia e-mail de verificação
- [ ] Link de verificação marca `emailVerified: true`
- [ ] Token é removido do banco após uso (não pode ser reutilizado)
- [ ] Reenvio gera novo token e invalida o anterior
- [ ] Reenvio para e-mail já verificado retorna erro
- [ ] Cadastro via Google já nasce com `emailVerified: true`, sem token gerado
- [ ] Login local funciona normalmente

## 9. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Nenhum token aparece na tabela `VerificationToken` | Servidor não recarregou o código novo — reinicie `npm run start:dev` |
| E-mail não chega | Confirme `RESEND_API_KEY` e se `MAIL_FROM` é um domínio de sandbox (só entrega pro dono da conta Resend) |
| Erro ao rodar `prisma migrate dev` | Rode `npx prisma generate` novamente e reinicie o TS Server do editor |
| `verificationToken` não reconhecido no TypeScript | Reinicie o TS Server (`Ctrl+Shift+P` → TypeScript: Restart TS Server) após qualquer `prisma generate` |

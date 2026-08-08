# Sincronizar os novos preços com o Stripe — passo a passo (terminal)

Você mudou os preços em lote no banco. Agora falta refleti-los no Stripe.
A função `sync-stripe-all` faz isso de uma vez: para cada plano/módulo pago,
cria os novos Prices (mensal/anual), arquiva os antigos e grava os ids no banco.

Prices do Stripe são **imutáveis** — por isso criamos novos e arquivamos os
antigos. Assinantes atuais continuam no preço que contrataram; os novos preços
valem para novas assinaturas.

> A `STRIPE_SECRET_KEY` fica **só nos Secrets do Supabase** (nunca no Cloudflare
> nem no painel do app). A função lê o secret pelo servidor.

---

## Pré-requisitos (uma vez)

1. **Secret no Supabase** — confirme que existe:
   Supabase → Project Settings → Edge Functions → Secrets → `STRIPE_SECRET_KEY`.

2. **Deploy da função** (ela é nova). Escolha um caminho:

   **A) Pelo painel:** Edge Functions → New function → nome `sync-stripe-all` →
   cole o conteúdo de `supabase/edge-functions/sync-stripe-all.js` → **verify_jwt = false**.

   **B) Pela CLI (Supabase CLI instalado e logado):**
   ```bash
   cd "C:\Users\GUSTAVO\seravie-experiences-hub"
   # A CLI espera a pasta supabase/functions/<nome>/index.ts
   mkdir -p supabase/functions/sync-stripe-all
   copy supabase\edge-functions\sync-stripe-all.js supabase\functions\sync-stripe-all\index.ts
   supabase functions deploy sync-stripe-all --no-verify-jwt --project-ref qgmffsrgfyphmuqvafdc
   ```

---

## Passo 1 — Pegar seu token de super admin

A função só roda para o super admin. Você precisa do **access token** da sua
sessão logada. Jeito mais fácil: logado no app (como super admin), abra o
Console do navegador (F12) e rode:

```js
JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('auth-token')))).access_token
```

Copie o valor (uma string longa). Ele é o `TOKEN` abaixo.

> Alternativa: qualquer forma de obter o `access_token` da sessão Supabase serve.

---

## Passo 2 — Simular primeiro (dry-run, não altera nada)

Recomendado: veja o que a função FARIA, sem tocar no Stripe.

```bash
curl -s -X POST "https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/sync-stripe-all" ^
  -H "Authorization: Bearer TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"dry_run\": true}"
```

(No PowerShell, use aspas simples e crase para quebra de linha, ou rode numa
linha só. No Git Bash/Linux use `\` no lugar de `^`.)

Você verá um JSON com `summary` e, por item, a lista de `actions` que ele
executaria ("criaria produto", "criaria price mensal R$249"…).

---

## Passo 3 — Rodar de verdade

Se o dry-run ficou como esperado, rode sem o dry_run:

```bash
curl -s -X POST "https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/sync-stripe-all" ^
  -H "Authorization: Bearer TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{}"
```

Resposta esperada: `"ok": true` e um `summary` com quantos foram criados.
Cada item traz o `product` (id do produto no Stripe) e as `actions` feitas.

---

## Opções do corpo (JSON)

| Campo      | Efeito |
|------------|--------|
| `dry_run`  | `true` = só simula, não altera nada. |
| `force`    | `true` = recria os Prices mesmo se já houver um id no banco (use se quiser forçar tudo do zero). |
| `only`     | `"plans"` ou `"modules"` = limita o escopo. Omitido = ambos. |

Exemplos:
```bash
# só os planos, forçando recriação
-d "{\"only\": \"plans\", \"force\": true}"

# só os módulos, simulação
-d "{\"only\": \"modules\", \"dry_run\": true}"
```

---

## Como conferir depois

- **No Stripe** (Dashboard → Products): cada plano/módulo aparece com o Price
  novo ativo e o antigo arquivado.
- **No banco** (Supabase → SQL): as colunas `stripe_price_monthly` /
  `stripe_price_yearly` de `plans` e `modules` devem ter os ids novos:
  ```sql
  select slug, price_monthly, stripe_price_monthly, stripe_price_yearly from plans where price_monthly>0;
  select slug, price_monthly, stripe_price_monthly, stripe_price_yearly from modules where price_monthly>0;
  ```

---

## Erros comuns

- `401 unauthorized` → token ausente/expirado. Refaça o Passo 1 (relogue se preciso).
- `403 forbidden` → o usuário do token não é super admin.
- `stripe_not_configured` → falta a `STRIPE_SECRET_KEY` nos Secrets do Supabase.
- `stripe_price_error` no item → veja `detail`; normalmente é moeda/valor inválido.

Depois desta sincronização, a página de preços e o checkout do app usam
automaticamente os novos Prices do Stripe.

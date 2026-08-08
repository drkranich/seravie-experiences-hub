# Cobrança de rede (Stripe graduated) + Convite de gerente por unidade

Duas Edge Functions novas:

- **`sync-unit-addon`** — cria no Stripe o item "Unidade adicional" com preço
  **graduated** (a escada 2-5=R$199, 6-15=R$149, 16+=R$99). O Stripe soma sozinho
  conforme a quantidade de unidades da rede.
- **`invite-manager`** — convida um gerente por e-mail, vinculado a uma **unidade**,
  com papel de Gestor. Ele define a senha e enxerga só a sua unidade.

Ambas leem segredos apenas do Supabase (nunca do front/Cloudflare).

---

## 1. Deploy

O CLI espera cada função em `supabase/functions/<nome>/index.ts` (já criei os dois).

```
cd "C:\Users\GUSTAVO\seravie-experiences-hub"
supabase functions deploy sync-unit-addon --project-ref qgmffsrgfyphmuqvafdc
supabase functions deploy invite-manager   --project-ref qgmffsrgfyphmuqvafdc
```

> `STRIPE_SECRET_KEY` (chave `sk_...` de produção) já está nos Secrets do Supabase —
> a mesma usada pelo `sync-stripe-all`. As duas funções reaproveitam os Secrets
> padrão do projeto (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), injetados
> automaticamente.

---

## 2. Sincronizar a escada no Stripe

Rode UMA vez (como super admin). Primeiro em teste (`dry_run`) para ver o que faria,
depois pra valer. Troque `SEU_TOKEN` pelo access token do super admin.

```
# ver o que faria (não altera nada)
curl -i -X POST "https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/sync-unit-addon" ^
  -H "Authorization: Bearer SEU_TOKEN" -H "Content-Type: application/json" ^
  -d "{ \"dry_run\": true }"

# criar de fato os preços graduated (mensal e anual)
curl -i -X POST "https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/sync-unit-addon" ^
  -H "Authorization: Bearer SEU_TOKEN" -H "Content-Type: application/json" ^
  -d "{}"
```

Resultado: um Produto **"Seravie — Unidade adicional"** com dois Prices
(`recurring`, `tiered`, `graduated`). O `price_id` mensal fica gravado em
`plan_addons` (faixa `unit-2-5`) como referência.

### Como usar na assinatura da rede

A cobrança final de uma rede é uma assinatura Stripe com **dois itens**:

1. o Price do **Enterprise** (base R$699 — já inclui a 1ª unidade + painel de rede);
2. o Price **graduated de unidade**, com `quantity` = nº total de unidades da rede.

O Stripe aplica a escada automaticamente: para 20 unidades, ele cobra
4×199 + 10×149 + 5×99, sem você calcular nada. Quando a rede abre/fecha uma loja,
basta atualizar a `quantity` desse item na assinatura.

---

## 3. Convidar gerente por unidade (no painel)

Em **Gestão → Franquias → Rede & Unidades**, cada unidade tem o botão
**"Convidar gerente"**. Informe o e-mail (e nome, opcional) e envie. A função:

1. cria/convida o usuário no Supabase Auth (e-mail para definir senha);
2. garante o papel **Gestor** no tenant;
3. cria a `membership` vinculada ao **tenant + unidade**, status `active`.

Assim cada gerente usa o **próprio e-mail** e vê só a sua unidade, enquanto o dono
da rede mantém uma conta única com a visão consolidada.

> Pré-requisito: quem convida precisa ser **admin** ou **super admin** da rede.

### Restringir o acesso do gerente à unidade (RLS)

A `membership.unit_id` já grava a unidade do gerente. Para que o gerente veja apenas
os dados da própria loja, as políticas de RLS das tabelas com `unit_id` devem
considerar essa coluna (ex.: `unit_id = get_my_unit_id()` além do `tenant_id`).
Isso é um ajuste de RLS por tabela — posso preparar numa próxima etapa se quiser
aplicar o isolamento por unidade de forma estrita.

---

## Resumo dos preços da escada (referência)

| Faixa        | Preço/mês por unidade |
|--------------|-----------------------|
| 1ª unidade   | inclusa na base (R$699) |
| 2ª à 5ª      | R$199                 |
| 6ª à 15ª     | R$149                 |
| 16ª+         | R$99                  |

Exemplos: 5 un. = R$1.495/mês · 10 un. = R$2.240 · 20 un. = R$3.480 · 50 un. = R$6.450.

# Worker de envio omnichannel — `omni-send`

Envia as respostas do agente (aba **Conversas**) pelo canal real da conversa:
**WhatsApp Cloud API**, **Instagram Messaging** e **E-mail** (fallback).

Os tokens **nunca ficam no painel nem no código** — cada tenant guarda os seus no
banco (`social_credentials` ou `messaging_channels.credentials`). A função roda com
o `service_role` e só ela lê esses segredos.

---

## 1. Deploy da função

```
cd "C:\Users\GUSTAVO\seravie-experiences-hub"
supabase functions deploy omni-send --project-ref qgmffsrgfyphmuqvafdc
```

> Já usa os Secrets padrão do projeto (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`),
> que o Supabase injeta automaticamente. Não precisa configurar mais nada de ambiente.

---

## 2. Credenciais por canal (por tenant)

As credenciais ficam no banco, por tenant. Você pode gravá-las de duas formas:

- **WhatsApp / Instagram:** na tabela `social_credentials` (preenchida pelo fluxo
  OAuth `social-oauth`) **ou**, manualmente, em `messaging_channels.credentials`.
- **E-mail:** em `messaging_channels` no canal `email_send` (mesma convenção do
  `send-email`).

### WhatsApp (Cloud API da Meta)

O que você vai precisar quando tiver a conta aprovada:
- `access_token` — token permanente do WhatsApp Business.
- `phone_number_id` — ID do número (aparece no painel de Desenvolvedores da Meta).

Gravação manual (exemplo, rodar no SQL do Supabase, trocando o `tenant_id`):

```sql
insert into public.messaging_channels (tenant_id, channel, is_enabled, status, credentials)
values ('<TENANT_ID>', 'whatsapp', true, 'connected',
  jsonb_build_object('access_token','<TOKEN>', 'phone_number_id','<PHONE_NUMBER_ID>'))
on conflict (tenant_id, channel) do update
  set credentials = excluded.credentials, is_enabled = true, status = 'connected';
```

### Instagram (Messaging da Meta)

- `access_token` — token da **página** vinculada à conta IG Business.
- `ig_id` — ID da conta usada no endpoint de mensagens (ou deixe em branco para `me`).
- Responde no Direct **dentro da janela de 24h** após a última mensagem do cliente
  (regra da Meta). O destinatário é o PSID/IGSID, guardado em
  `conversations.channel_id`.

```sql
insert into public.messaging_channels (tenant_id, channel, is_enabled, status, credentials)
values ('<TENANT_ID>', 'instagram', true, 'connected',
  jsonb_build_object('access_token','<TOKEN>', 'ig_id','<IG_ID>'))
on conflict (tenant_id, channel) do update
  set credentials = excluded.credentials, is_enabled = true, status = 'connected';
```

### E-mail (fallback — funciona já hoje)

Provedores aceitos: `resend`, `sendgrid`, `smtp`, `ses`. Serve pra testar o fluxo
ponta a ponta **antes** de ter os tokens da Meta.

```sql
insert into public.messaging_channels (tenant_id, channel, is_enabled, status, credentials)
values ('<TENANT_ID>', 'email_send', true, 'connected',
  jsonb_build_object('provider','resend','from_email','contato@seudominio.com',
                     'from_name','Sua Marca','api_key','<RESEND_API_KEY>'))
on conflict (tenant_id, channel) do update
  set credentials = excluded.credentials, is_enabled = true, status = 'connected';
```

---

## 3. Como testar

Na aba **Conversas**, ao responder numa conversa cujo canal seja WhatsApp,
Instagram ou E-mail, a mensagem é gravada e a função dispara o envio. A bolha mostra:

- **✓ enviado** — foi entregue à API do canal.
- **registrado** — canal sem envio automático (segue só no histórico).
- **⚠ falha** — o envio falhou (passe o mouse para ver o motivo).

Teste rápido de um canal, sem abrir conversa (via `supabase.functions.invoke`):

```js
await supabase.functions.invoke('omni-send', {
  body: { action: 'test', channel: 'email', to: 'voce@exemplo.com' }
})
```

---

## 4. Fila (próxima etapa, já preparada)

A migração `omni_send_delivery_and_queue` criou a tabela **`message_queue`** com
`status/attempts/next_attempt_at/payload/result` e RLS por tenant. Quando quiser
escalar para envio em lote com retry, um processador em cron lê essa fila e chama a
mesma lógica de `omni-send`. A estrutura já está pronta — é só plugar o processador.

---

## Destinatário por canal (referência)

| Canal      | De onde vem o destino                              |
|------------|----------------------------------------------------|
| WhatsApp   | `conversations.channel_id` ou telefone do contato  |
| Instagram  | `conversations.channel_id` (PSID/IGSID)            |
| E-mail     | `conversations.channel_id` ou e-mail do contato    |

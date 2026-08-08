# Roadmap — o que depende só de você (Gustavo)

Tudo aqui é ação **externa ao código** que eu não posso executar por você:
publicar código, criar apps em plataformas, cadastrar segredos, apontar domínios
e configurar contas. Está em ordem de prioridade. Marque com [x] conforme fizer.

Legenda de esforço: 🟢 rápido (min) · 🟡 médio (algumas horas) · 🔴 depende de terceiros/aprovação.

---

## 0. Fundamental e recorrente — publicar o que foi construído

Eu escrevo o código e gravo no seu PC; **subir para o GitHub e publicar é seu**.

- [ ] 🟢 **Fazer o push do código pendente** (Marketing Hub, Edge Functions, etc.)
  ```
  cd "C:\Users\GUSTAVO\seravie-experiences-hub"
  git add -A
  git commit -m "feat: marketing hub completo + edge functions sociais"
  git push
  ```
- [ ] 🟢 **Publicar o site** (o deploy/publish é etapa separada do push — Cloudflare/Vercel
  conforme sua hospedagem). Confirmar que a nova versão entrou no ar.
- [ ] 🟢 Após publicar, **forçar recarga sem cache** no navegador para ver a versão nova
  (Ctrl+Shift+R), pois o bundle antigo costuma ficar em cache.

---

## 1. Edge Functions de redes sociais e landing pages — PENDENTES de publicação

As três functions novas existem só nos arquivos; **ainda não estão no Supabase**.
Guia detalhado: `supabase/edge-functions/SOCIAL_SETUP.md`.

- [ ] 🟡 **Publicar `social-oauth`** no Supabase — deploy com **verify_jwt = false**.
- [ ] 🟡 **Publicar `social-publish`** — deploy com **verify_jwt = true**.
- [ ] 🟡 **Publicar `landing-render`** — deploy com **verify_jwt = false**.

> Observação: essas 3 já existem localmente em `supabase/edge-functions/`. No painel
> do Supabase, crie cada function com o mesmo nome e cole o conteúdo do arquivo.

---

## 2. Apps das redes sociais (cada empresa conecta a própria conta)

Para o "Conectar via OAuth" funcionar, é preciso um app aprovado em cada plataforma.
Você cria os apps; os tokens de cada cliente são obtidos pelo OAuth automaticamente.

- [ ] 🔴 **Meta (Instagram + Facebook)** — criar app em developers.facebook.com,
  pedir permissões (`instagram_content_publish`, `pages_manage_posts`), passar pela
  revisão do app. Cadastrar secrets `META_APP_ID` e `META_APP_SECRET`.
- [ ] 🔴 **TikTok** — app em developers.tiktok.com (Content Posting API).
  Secrets `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
- [ ] 🔴 **LinkedIn** — app em linkedin.com/developers (Marketing/UGC).
  Secrets `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.
- [ ] 🔴 **Pinterest** — app em developers.pinterest.com (API v5).
  Secrets `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`.
- [ ] 🟢 Em **cada** app, cadastrar a Redirect URI:
  ```
  https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/social-oauth?action=callback
  ```

> Você pode começar por UMA rede (ex.: Instagram/Facebook via Meta) e ativar as
> demais depois. Não precisa de todas para funcionar.

---

## 3. Secrets do Supabase (você coloca; nunca vão no painel do app)

Em Supabase → Project Settings → Edge Functions → Secrets. Coloque só os das redes
que for usar + o provedor de e-mail/mensagens quando for disparar de verdade.

- [ ] 🟢 Secrets das redes (item 2 acima).
- [ ] 🟢 (opcional) `OAUTH_REDIRECT_BASE` se usar domínio próprio de functions.
- [ ] 🟡 **Provedor de e-mail** para campanhas/automações realmente enviarem:
  ex. `RESEND_API_KEY` (Resend) — hoje o envio fica "enfileirado" até existir provedor.
- [ ] 🟡 (opcional) **WhatsApp/SMS**: credenciais Twilio/Meta WhatsApp quando for disparar
  esses canais de verdade.

> ⚠️ Sua regra de sempre: **chaves secretas ficam aqui, nos Secrets — nunca no painel.**
> Isso continua valendo. Eu nunca coloco tokens/segredos no código do front.

---

## 4. Stripe (já em uso no projeto) — parte sua

- [ ] 🟢 Confirmar que a **chave secreta do Stripe** está nos Secrets do Supabase
  (não no Cloudflare) — conforme você sempre fez.
- [ ] 🟡 Conferir o **webhook do Stripe** apontando para a function `stripe-webhook`.

---

## 5. Domínio & links públicos

- [ ] 🟡 (opcional, recomendado) Apontar `seravieexperiences.com/lp/<slug>` para a
  function `landing-render`, preservando o slug, para ter link bonito.
  Enquanto não fizer, o "compartilhar link" usa a URL direta da function (já funciona).
- [ ] 🟢 Verificar DNS/SSL do domínio de produção.

---

## 6. Testes de aceitação (fazer após publicar)

Roteiro rápido para validar cada frente ao vivo:

- [ ] 🟢 **Perfis & Permissões**: abrir um perfil de sistema (só leitura), criar um perfil
  novo, editar e excluí-lo.
- [ ] 🟢 **Automações**: criar uma automação livre, editar, excluir; criar um evento
  personalizado e disparar teste.
- [ ] 🟢 **Jornadas**: montar uma jornada no canvas, conectar nós, salvar, ativar.
- [ ] 🟢 **Audience**: criar um público com regras E/OU e conferir a contagem.
- [ ] 🟢 **Formulários**: criar um formulário, ver a prévia.
- [ ] 🟢 **Landing Pages**: montar uma página, subir imagem, publicar, compartilhar link,
  abrir o link e enviar o formulário (deve virar contato).
- [ ] 🟡 **Conexão de rede** (após app aprovado): conectar via OAuth e publicar um post.

---

## 7. Backups e segurança (boa prática contínua)

- [ ] 🟡 Confirmar backups automáticos do Supabase (Point-in-Time Recovery no plano).
- [ ] 🟢 Revisar quem tem acesso de **super_admin** no painel.
- [ ] 🟢 Guardar as credenciais dos apps de redes num gerenciador de senhas.

---

## Resumo do que JÁ está pronto (não precisa de você)

Só para você saber que não precisa mexer nisto — já foi feito e aplicado por mim:

- Todas as **tabelas e RLS** do Marketing Hub no Supabase (campanhas, automações,
  jornadas, públicos, canais, indicações, formulários, posts, landing pages,
  eventos, e a tabela **segura** de tokens `social_credentials`).
- O **código** dos 5 estúdios do Marketing Hub, automações livres, eventos
  personalizados, upload de imagem, e as 3 Edge Functions (gravados no seu PC).
- O **motor de eventos** ligado ao PDV (vendas já emitem eventos).

O que falta é **só o que está neste roadmap** — publicar, criar apps, cadastrar
segredos e apontar domínio.

# Redes sociais & Landing Pages — configuração (Seravie Marketing Hub)

Três Edge Functions dão vida às conexões de redes e às landing pages públicas.
Cada empresa (tenant) conecta a **própria** conta; os tokens ficam em
`public.social_credentials`, tabela **sem acesso do cliente** (RLS forçada, zero
políticas) — só as functions (service_role) leem/gravam.

## Deploy das functions

No painel do Supabase (Edge Functions) ou via CLI, publique os três arquivos:

| Função           | verify_jwt | Papel |
|------------------|-----------|-------|
| `social-oauth`   | **false** | Inicia o OAuth e recebe o callback da rede (sem JWT). |
| `social-publish` | **true**  | Publica um post; exige usuário logado (valida tenant). |
| `landing-render` | **false** | Serve a landing page pública e recebe formulários. |

> Os `.js` aqui são o corpo de cada function. Ao criar no Supabase, use o mesmo
> nome do arquivo (sem extensão) como nome da function.

## Secrets (Supabase → Project Settings → Edge Functions → Secrets)

Já existem por padrão: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Adicione conforme as redes que for usar (você cria os apps em cada plataforma):

```
# Meta (Instagram + Facebook) — https://developers.facebook.com
META_APP_ID=...
META_APP_SECRET=...

# TikTok — https://developers.tiktok.com
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...

# LinkedIn — https://www.linkedin.com/developers
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Pinterest — https://developers.pinterest.com
PINTEREST_APP_ID=...
PINTEREST_APP_SECRET=...

# (opcional) base do redirect, se usar domínio próprio de functions
OAUTH_REDIRECT_BASE=https://<ref>.functions.supabase.co/social-oauth
```

## Redirect URI (OAuth) — cadastre em CADA app da plataforma

```
https://<ref>.supabase.co/functions/v1/social-oauth?action=callback
```

(ou, se definir `OAUTH_REDIRECT_BASE`, use `<OAUTH_REDIRECT_BASE>?action=callback`)

## Como funciona (resumo)

1. No painel, a empresa clica **Conectar via OAuth** → abre popup para
   `social-oauth?action=start&network=..&tenant=..`.
2. A função cria um `state` (tabela `social_oauth_states`) e redireciona para o
   login da rede.
3. A rede chama de volta `?action=callback&code=..&state=..`; a função troca o
   `code` pelo `access_token` e grava em `social_credentials` (do tenant certo).
   O token **nunca** volta ao navegador.
4. Publicar um post chama `social-publish` com `{post_id}`; a função lê o token
   do tenant e posta na(s) rede(s).
5. A landing publicada é servida por
   `landing-render?slug=<slug>&tenant=<uuid>`; os formulários enviam para
   `landing-render?action=submit` e viram contatos + `form_submissions`.

## Domínio bonito (opcional)

Para servir a landing como `seravieexperiences.com/lp/<slug>`, aponte essa rota
(no Cloudflare/hosting) para a function `landing-render` preservando o `slug`.
Enquanto isso, o link compartilhado usa a URL direta da function, que já funciona.

## Notas por rede

- **Instagram**: exige conta Business ligada a uma Página do FB e **imagem**
  (não publica só texto). Requer `external_account_id` = IG User ID.
- **Facebook**: publica no feed da Página; `external_account_id` = Page ID.
- **LinkedIn**: `external_account_id` = URN do autor (`urn:li:person:...` ou org).
- **Pinterest**: exige imagem e `meta.board_id`.
- **TikTok**: fluxo de vídeo (Content Posting API) — deixado como `skipped` até
  você habilitar o upload de vídeo.

Esses ids/boards podem ser preenchidos na conexão manual ou por uma extensão do
callback (buscar contas/páginas após o token) numa próxima iteração.

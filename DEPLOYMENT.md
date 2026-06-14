# 🚀 Guia de Deployment - Seravie Experiences v1.5

## Status Atual

✅ **Frontend**: Cloudflare Pages  
✅ **Banco de dados**: Supabase PostgreSQL  
✅ **Admin Panel**: Integrado com autenticação  
✅ **Formulário de Contato**: Funcional  

---

## 📋 Próximos Passos

### 1. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
VITE_SUPABASE_URL=https://qgmffsrgfyphmuqvafdc.supabase.co
VITE_SUPABASE_KEY=sua_chave_publica
VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

### 2. Deploy Edge Functions (Emails)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Deploy function
supabase functions deploy send-contact-email
```

Depois configure a variável de ambiente no Supabase:
- `RESEND_API_KEY` = sua chave Resend.com

### 3. Configurar Domínio Customizado

**No Cloudflare Pages:**
1. Vá em **Settings → Custom Domain**
2. Adicione seu domínio (ex: seravie-experiences.com)
3. Configure DNS no seu registrador

**No Supabase:**
1. Vá em **Auth → URL Configuration**
2. Adicione a URL do seu domínio
3. Configure CORS se necessário

### 4. Setup Google Analytics

1. Vá em https://analytics.google.com
2. Crie uma nova propriedade
3. Pegue o ID (G-XXXXXXXXXX)
4. Adicione em `.env`

### 5. Ativar HTTPS

- Cloudflare Pages já fornece HTTPS automático
- Supabase também usa HTTPS por padrão
- Sempre force HTTPS nas configurações

---

## 🔐 Segurança

### Checklist de Segurança

- [ ] Todas as chaves em `.env` (não no código)
- [ ] RLS ativado no Supabase (feito)
- [ ] CORS configurado corretamente
- [ ] Rate limiting no formulário
- [ ] Emails verificados
- [ ] Backup automático ativado

### Ativar Backups Supabase

1. Vá em **Backups** no Supabase
2. Escolha frequência (diária recomendada)
3. Configure período de retenção

---

## 📊 Monitoramento

### Logs Cloudflare Pages
```bash
wrangler tail
```

### Logs Supabase
Vá em **Logs** → **Edge Functions** ou **PostgreSQL** no console

### Métricas
- Performance: Cloudflare Analytics
- Usuários: Google Analytics
- Banco de dados: Supabase Dashboard

---

## 🔄 Atualizações e Manutenção

### Deploy de Atualizações

```bash
git add .
git commit -m "feat: descrição da mudança"
git push origin main
# Cloudflare faz deploy automaticamente!
```

### Rollback

Se algo der errado:

```bash
git revert <commit-hash>
git push origin main
```

---

## 📱 Teste Local

```bash
npm run dev
# Abre em http://localhost:5173
```

### Testar Admin Panel
- Email: qualquer@email.com
- Senha: qualquer coisa

---

## 🆘 Troubleshooting

### "Erro ao conectar Supabase"
- Verifique se a chave está em `.env`
- Confirme RLS está habilitado
- Teste com `curl` para a API do Supabase

### "Email não está enviando"
- Verifique se Edge Function está deployada
- Configure RESEND_API_KEY
- Teste manualmente no Supabase

### "Admin panel não carrega"
- Limpe cache (F12 → Application → Storage)
- Verifique localStorage
- Teste em incógnito

---

## 📞 Suporte

- Supabase Docs: https://supabase.com/docs
- Cloudflare Pages: https://pages.cloudflare.com
- React Docs: https://react.dev
- Vite Docs: https://vitejs.dev

---

**Última atualização**: Junho 2026  
**Versão**: v1.5  
**Status**: ✅ Pronto para Produção

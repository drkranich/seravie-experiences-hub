# 📚 API Documentation - Seravie Experiences

Base URL: `https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1`

---

## 🔑 Autenticação

Usar header:
```
Authorization: Bearer YOUR_SUPABASE_KEY
```

---

## 📦 Endpoints

### Especialidades

#### GET /specialties
Listar todas as especialidades publicadas

```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/specialties?select=*&published=eq.true
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "icon_name": "string",
    "order": 1,
    "published": true,
    "created_at": "timestamp"
  }
]
```

#### POST /specialties
Criar nova especialidade (admin only)

```bash
curl -X POST \
  -H "Authorization: Bearer ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nova Especialidade",
    "description": "Descrição",
    "published": true
  }' \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/specialties
```

#### PATCH /specialties?id=eq.UUID
Atualizar especialidade

```bash
curl -X PATCH \
  -H "Authorization: Bearer ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Título atualizado"}' \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/specialties?id=eq.UUID
```

#### DELETE /specialties?id=eq.UUID
Deletar especialidade

```bash
curl -X DELETE \
  -H "Authorization: Bearer ADMIN_KEY" \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/specialties?id=eq.UUID
```

---

### Portfólio

#### GET /portfolio_items
Listar todos os itens publicados

```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/portfolio_items?select=*&published=eq.true
```

#### POST /portfolio_items
Criar novo item

```bash
curl -X POST \
  -H "Authorization: Bearer ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Novo Projeto",
    "description": "Descrição do projeto",
    "category": "digital",
    "published": true
  }' \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/portfolio_items
```

---

### Contato

#### POST /contact_submissions
Enviar mensagem de contato

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@email.com",
    "message": "Mensagem de contato",
    "phone": "+55 11 99999-9999"
  }' \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/contact_submissions
```

#### GET /contact_submissions
Listar mensagens (admin only)

```bash
curl -H "Authorization: Bearer ADMIN_KEY" \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/contact_submissions
```

---

### Seções

#### GET /sections?key=eq.SECTION_KEY
Obter conteúdo de uma seção

```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  https://qgmffsrgfyphmuqvafdc.supabase.co/rest/v1/sections?key=eq.hero
```

---

## 🔒 Rate Limiting

- **Limite**: 1000 requisições por hora
- **Header**: `X-RateLimit-Remaining`

---

## ⚠️ Erros

| Code | Meaning |
|------|---------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Server Error |

---

## 📝 Exemplos

### JavaScript/React

```javascript
import { supabase } from './lib/supabase'

// Buscar especialidades
const { data } = await supabase
  .from('specialties')
  .select('*')
  .eq('published', true)

// Criar novo item
const { data, error } = await supabase
  .from('portfolio_items')
  .insert([{
    title: 'Novo Projeto',
    description: 'Descrição',
    published: true
  }])

// Atualizar
await supabase
  .from('specialties')
  .update({ title: 'Novo Título' })
  .eq('id', specialtyId)

// Deletar
await supabase
  .from('portfolio_items')
  .delete()
  .eq('id', itemId)
```

---

## 📞 Suporte

Para mais informações: https://supabase.com/docs

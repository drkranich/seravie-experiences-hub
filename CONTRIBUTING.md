# 🤝 Guia de Contribuição - Seravie Experiences

Obrigado por estar interessado em contribuir! Este documento guia o processo.

---

## 🚀 Como Começar

### 1. Setup Local

```bash
# Clone o repositório
git clone https://github.com/drkranich/seravie-experiences-hub.git
cd seravie-experiences-hub

# Instale dependências
npm install

# Crie arquivo .env local
cp .env.example .env.local

# Inicie servidor de desenvolvimento
npm run dev
```

### 2. Crie uma Branch

```bash
git checkout -b feature/sua-feature
# ou
git checkout -b fix/seu-fix
```

---

## 📋 Padrões

### Commits

Use conventional commits:

```
feat: adicionar nova funcionalidade
fix: corrigir bug
docs: atualizar documentação
style: formatar código
refactor: reorganizar código
test: adicionar testes
chore: atualizar dependências
```

### Branches

- `main` - Produção
- `develop` - Desenvolvimento
- `feature/*` - Novas features
- `fix/*` - Bug fixes
- `docs/*` - Documentação

### Código

- Use ES6+
- Componentes em PascalCase
- Funções em camelCase
- Constantes em UPPER_SNAKE_CASE

### Testes

```bash
npm run test
npm run test:coverage
```

---

## 🔄 Processo de Contribuição

1. **Fork** o repositório
2. **Clone** seu fork
3. **Crie** uma branch (`git checkout -b feature/nova-feature`)
4. **Faça** seus changes
5. **Commit** com mensagens descritivas
6. **Push** para sua branch
7. **Abra** um Pull Request

---

## ✅ Checklist PR

Antes de submeter:

- [ ] Código testado localmente
- [ ] Testes escritos/atualizados
- [ ] Documentação atualizada
- [ ] Commit messages claras
- [ ] Sem console.log em produção
- [ ] Sem secrets hardcoded

---

## 🧪 Testes

```bash
# Rodar todos os testes
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Específico
npm run test -- src/components/ContactForm.test.jsx
```

---

## 📚 Documentação

- `README.md` - Visão geral
- `CLAUDE.md` - Arquitetura técnica
- `DEPLOYMENT.md` - Como fazer deploy
- `API.md` - Documentação de API

---

## 🐛 Reportar Bugs

1. Verifique se o bug já foi reportado
2. Descreva o comportamento esperado
3. Inclua passos para reproduzir
4. Adicione screenshots se relevante

---

## 💡 Sugestões de Features

Abra uma Issue com:
- Descrição clara
- Caso de uso
- Benefício esperado
- Qualquer contexto relevante

---

## 📞 Dúvidas?

- Abra uma Issue
- Veja a documentação existente
- Consulte o Roadmap

---

Obrigado por contribuir! 🎉

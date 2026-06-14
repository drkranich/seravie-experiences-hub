# 🧪 Testing Guide - Seravie Experiences

Guia completo para testing do projeto.

---

## 🏗️ Estrutura de Testes

```
src/
├── components/
│   ├── ContactForm.jsx
│   ├── ContactForm.test.jsx
│   └── __mocks__/
├── hooks/
│   ├── useSpecialties.js
│   ├── useSpecialties.test.js
│   └── __mocks__/
└── utils/
    ├── seo.js
    ├── seo.test.js
    └── __mocks__/
```

---

## ✍️ Escrevendo Testes

### Componentes

```javascript
import { render, screen } from '@testing-library/react'
import { ContactForm } from './ContactForm'

describe('ContactForm', () => {
  it('renderiza formulário de contato', () => {
    render(<ContactForm />)
    expect(screen.getByPlaceholderText(/seu nome/i)).toBeInTheDocument()
  })

  it('submete formulário com dados válidos', async () => {
    render(<ContactForm />)
    // ... teste de submissão
  })
})
```

### Hooks

```javascript
import { renderHook, act } from '@testing-library/react'
import { useSpecialties } from './useSpecialties'

describe('useSpecialties', () => {
  it('carrega especialidades', async () => {
    const { result } = renderHook(() => useSpecialties())
    
    await act(async () => {
      // ... wait for loading
    })

    expect(result.current.specialties).toHaveLength(4)
  })
})
```

### Utilidades

```javascript
import { validateEmail } from '../utils/security'

describe('validateEmail', () => {
  it('valida email correto', () => {
    expect(validateEmail('test@example.com')).toBe(true)
  })

  it('rejeita email inválido', () => {
    expect(validateEmail('invalid')).toBe(false)
  })
})
```

---

## 🚀 Rodando Testes

```bash
# Todos os testes
npm run test

# Watch mode (rerun on change)
npm run test:watch

# Coverage report
npm run test:coverage

# Teste específico
npm run test -- ContactForm.test.jsx

# Update snapshots
npm run test -- -u
```

---

## 📊 Coverage

Target: **70%** em todos os types

Visualizar coverage:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

---

## 🔧 Mocking

### Supabase

```javascript
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: jest.fn().mockResolvedValue({ data: [] }),
      insert: jest.fn().mockResolvedValue({ data: {} }),
      update: jest.fn().mockResolvedValue({ data: {} }),
      delete: jest.fn().mockResolvedValue({ data: {} }),
    }),
  },
}))
```

### Fetch

```javascript
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockData),
  })
)
```

---

## ✅ Best Practices

1. **Um teste por caso** - Teste um comportamento por teste
2. **Nomes descritivos** - Descreva o que está testando
3. **Arrange-Act-Assert** - Setup → Ação → Verificação
4. **Mock externos** - Mock APIs, banco de dados
5. **Test behavior** - Teste comportamento, não implementação
6. **Keep it DRY** - Use setup comum em beforeEach

---

## 🎯 Cobertura por Tipo

| Tipo | Target |
|------|--------|
| Branches | 70% |
| Functions | 70% |
| Lines | 70% |
| Statements | 70% |

---

## 🔍 Debug

```javascript
// Ver renderização
screen.debug()

// Verificar queries
screen.logTestingPlaygroundURL()

// Wait for element
await screen.findByText(/loading/i)

// Dentro de testes
test('...', () => {
  const element = render(<Component />)
  console.log(element.container.innerHTML)
})
```

---

## 📚 Recursos

- Jest: https://jestjs.io
- React Testing Library: https://testing-library.com/react
- Common mistakes: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

---

Boa sorte com os testes! 🚀

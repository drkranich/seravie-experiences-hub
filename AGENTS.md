## Imported Claude Cowork project instructions

## Seravie — Regras de Design System (obrigatórias)

Identidade: verde-musgo profundo, champanhe acetinado, cobre refinado, glassmorphism fumê.
Tipografia: títulos serif (Cormorant Garamond), interface sans (Manrope).

Regras que valem para todo o projeto:

1. **Formulários sempre em glassmorphism.** Nada de aparência nativa do sistema
   operacional em campos, selects, botões ou modais. Para selects use o componente
   `GlassSelect` (`src/components/admin/ui.jsx`) — nunca `<select>` nativo, que
   herda a lista de opções branca do SO.
2. **Dropdowns / menus / popovers** usam a classe `.glass-pop` (glass escuro e
   opaco o suficiente para o conteúdo atrás NÃO transparecer). Glass translúcido
   demais (ex.: `.glass` puro) não deve ser usado em camadas sobrepostas a texto.
3. **Qualquer calendário / date picker** deve ser glassmorphism, porém NÃO
   totalmente translúcido — seguir o mesmo padrão do `.glass-pop`. Campos
   `type="date"` herdam tema escuro via `color-scheme: dark` (definido em `:root`).
4. Multi-tenant real: toda tabela nova com RLS `tenant_id = get_my_tenant_id()`
   (com `with_check`). Nada de fork de código por segmento — usar módulos/flags.
5. Preservar o existente: não quebrar landing pública, CMS, rotas, auth e deploy
   (Cloudflare). Mudanças incrementais, com migrations idempotentes.

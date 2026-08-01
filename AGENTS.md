## Imported Claude Cowork project instructions

## Seravie — Diretriz Estratégica (LER PRIMEIRO)

Visão-mãe do produto em `DIRETRIZ_ESTRATEGICA.md` (raiz do repo). Resumo obrigatório:

- A Seravie Experiences opera em **duas frentes**: (1) SaaS vendido a terceiros e
  (2) **sistema operacional oficial da própria rede de franquias físicas Seravie**.
  A plataforma é o **coração operacional da empresa**, não só software para clientes.
- A franquia vende **transformação de negócios por experiência** (um ecossistema),
  não software. Seis pilares: **Digital, Space, Brand, Product, Academy, Intelligence**.
- Modelos de unidade: **Studio, Experience Center, Regional Hub, Signature Center**.
- Camadas de franquia (= planos): **Digital → Experience → Space → Certified → Signature**.
- Prever módulos da rede: **Expansão, Franqueados, Implantações**, **Experience Standards**
  (padrões físicos versionáveis), **Catálogo Oficial** (marketplace interno) e
  **Experience Certification** (auditoria + selo).

Regra de ouro de engenharia: **sempre a solução extensível e configurável, nunca a
pontual por cliente.** Multi-tenant + `unit_id`, config-driven (verticais, navegação,
planos, permissões, Design System), i18n desde já (PT/EN/ES), IA transversal. Cada
módulo deve servir tanto a um cliente SaaS independente quanto a uma unidade da rede.

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
3. **Qualquer calendário / date picker** usa o componente `GlassDate`
   (`src/components/admin/ui.jsx`) — NUNCA `<input type="date">` nativo (popup
   do SO não estilizável). O calendário é glass (`.glass-pop`, escuro/opaco),
   ancorado ao campo e abre para baixo ou para cima conforme o espaço (não
   flutua solto). Popovers em geral (GlassSelect/GlassDate) seguem o mesmo
   comportamento de ancoragem.
4. Multi-tenant real: toda tabela nova com RLS `tenant_id = get_my_tenant_id()`
   (com `with_check`). Nada de fork de código por segmento — usar módulos/flags.
5. Preservar o existente: não quebrar landing pública, CMS, rotas, auth e deploy
   (Cloudflare). Mudanças incrementais, com migrations idempotentes.

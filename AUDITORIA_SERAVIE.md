# Auditoria Seravie Experiences — o que falta para competir com Cacau Show / Brasil Cacau

_Auditoria técnica de estado atual e roadmap priorizado. Base: 86 tabelas no banco, navegação config-driven, RLS, auth e Edge Functions._

---

## 1. Onde estamos (o que já está sólido)

- **14 frentes de negócio + Artesanato** com CRUD completo (criar/editar/duplicar/excluir), KPIs, filtros, detalhe e export CSV/PDF via um núcleo reutilizável (`ResourcePanel`).
- **PDV robusto**: caixa (abertura/fechamento/sangria), leitor de código de barras, comandas, baixa de estoque, e agora transversal (vende produtos + peças de artesanato).
- **E-commerce transversal**: vitrine desacoplada, loja pública por tenant (`#loja/<slug>`), carrinho, cálculo de frete Melhor Envio (token por lojista) e pedido.
- **Canais de venda**: hub de credenciais para Mercado Livre, Magalu, Amazon, Shopee, TikTok Shop, Instagram (teste de conexão real ML + Meta; import de pedidos ML).
- **Governança inicial**: auditoria automática (`audit_logs`) e editor de perfis/permissões.
- **CRM 360, Financeiro, Operações, Franquias, Agenda com observações, Marketing, Automations** — em graus variados de profundidade.

## 2. 🔴 Segurança & Autenticação (CRÍTICO — resolver primeiro)

Esta é a maior lacuna para um SaaS comercial. Hoje:

1. **Permissões não são aplicadas.** Existe `RolesPanel` (define perfis) e `hasPermission()` no front, mas **nada gateia as telas nem as ações**. No banco, quase toda tabela tem **uma única policy `tenant_id = get_my_tenant_id()` para ALL** — ou seja, qualquer usuário do tenant lê e escreve tudo. Um "operador de caixa" pode apagar o financeiro. **Precisa: enforcement de RBAC** na navegação (esconder módulos), nas ações (botões) e idealmente no banco (policies por papel).
2. **Sem fluxo de convite de usuários.** A tabela `invitations` existe mas está **sem policies** (inacessível). Não há como o dono do tenant convidar a equipe com um papel.
3. **Auth mínima**: só login por e-mail/senha. Faltam: **cadastro/onboarding de novo tenant (self-service)**, **recuperação de senha**, **verificação de e-mail**, **2FA/MFA**, expiração de sessão, e logout em todos os dispositivos.
4. **Sem trilha de acesso/login** no `audit_logs` (só registramos CRUD; faltam eventos de login, falha de login, troca de senha).
5. **Rotação de segredos**: o token do GitHub foi exposto em texto puro nesta sessão — **revogar**. E definir um cofre para segredos de tenant (hoje em colunas jsonb com RLS — aceitável, mas convém criptografia em repouso para tokens de marketplace/pagamento).
6. **LGPD**: há tabelas de consentimento (`contact_consents`, `contact_preferences`) mas sem fluxo de exportação/exclusão de dados do titular nem política de retenção.

## 3. 🔴 Fiscal & Pagamentos (CRÍTICO para varejo no Brasil)

Sem isto, não compete com nenhuma rede de varejo brasileira:

1. **Emissão fiscal**: **NFC-e** (consumidor, no PDV) e **NF-e** (e-commerce/atacado), **NFS-e** para serviços. Exige integração com SEFAZ (via provedor: Focus NFe, PlugNotas, NFe.io, Tecnospeed). Inclui certificado digital A1 por tenant, séries, contingência, cancelamento, carta de correção, DANFE.
2. **Pagamento no PDV (presencial)**: integração **TEF/maquininha** (PagSeguro, Stone, Cielo, Mercado Pago Point), **Pix presencial (QR dinâmico)**, conciliação de recebíveis.
3. **Pagamento no e-commerce (checkout)**: **Stripe / Pix / cartão** — já planejado como última etapa. Falta o checkout de ponta a ponta (hoje o pedido entra como "a combinar").
4. **Impostos**: cálculo de ICMS/ST, CFOP, NCM por produto, regime tributário (Simples/Presumido), MVA. Campos `ncm`/`cfop`/`origem` nos produtos ainda não existem.
5. **Conciliação financeira**: baixa automática de recebíveis de cartão/marketplace, taxas por adquirente, antecipação.

## 4. 🟠 E-commerce & Omnichannel (em progresso — completar)

1. **Checkout com pagamento** (ver seção 3).
2. **Motor de sincronização dos marketplaces**: hoje só ML importa pedidos. Falta, por canal: **publicar/atualizar anúncios**, **sincronizar estoque e preço**, **importar pedidos** (Amazon SP-API, Shopee com assinatura HMAC, TikTok Shop, Magalu, Instagram/Meta catálogo). Cada um exige app aprovado e OAuth próprio.
3. **Gestão unificada de pedidos** (OMS): status, faturamento, expedição, rastreio, devoluções/trocas — cruzando loja própria + marketplaces.
4. **Etiqueta de envio**: comprar/gerar etiqueta no Melhor Envio (hoje só cotamos), rastreamento e impressão.
5. **Delivery**: integração **iFood / Rappi / Uber Eats** (essencial para chocolate/cafeteria/padaria).
6. **Storefront**: busca, categorias/coleções, variações (tamanho/sabor), cupons na loja, cálculo de frete no checkout, SEO, domínio próprio por tenant (multi-domínio Cloudflare), carrinho persistente, recuperação de carrinho abandonado.

## 5. 🟠 Franchising (para competir com Cacau Show — ~4.000 lojas)

O diferencial da Cacau Show é a **gestão de rede franqueada**. Precisa aprofundar:

1. **Multi-unidade real**: catálogo/preço central com override por loja, transferência de estoque entre unidades, estoque por unidade (`unit_id` já existe em várias tabelas — falta a operação).
2. **Royalties e taxas**: cálculo automático de royalties/fundo de propaganda sobre faturamento da unidade, faturas ao franqueado, inadimplência.
3. **Pedido do franqueado à central (B2B)**: catálogo atacado, pedido mínimo, prazos, aprovação, faturamento intercompany.
4. **Padronização & compliance**: checklists de loja (existe base), auditorias de campo com foto e nota, planos de ação, ranking de unidades (existe embrião em Operações/Franquias — aprofundar).
5. **Visual merchandising & campanhas de rede**: distribuição de material, datas sazonais (Páscoa é ~40% do faturamento da Cacau Show), controle de execução por loja.
6. **Onboarding de franqueado**: contrato, treinamento (Conhecimento/cursos existe embrião), certificação.

## 6. 🟡 Módulos núcleo a aprofundar (139 subpáginas ainda são placeholder)

A navegação promete muito que ainda abre a página genérica. As de maior valor:

- **Conversas (omnichannel)**: WhatsApp Business API, Instagram DM, e-mail, chat do site num inbox único. Hoje é embrião.
- **Help Desk**: SLA, filas, escalonamento, base de conhecimento, NPS — tabelas existem (`sla_policies`, `tickets`), falta UI.
- **Seravie AI**: agentes, sugestões, relatórios — hoje é chat básico. Definir provedor e casos de uso reais (recomendação, previsão de demanda, resposta a cliente).
- **Marketing**: campanhas de e-mail/WhatsApp/SMS reais (provedor), automações com gatilhos executando de verdade (hoje "configurado, não executa"), cupons, segmentação, fidelidade.
- **Conhecimento**: cursos, aulas, certificados, versionamento (tabelas existem `courses`/`lessons`/`certificates`).
- **Analytics**: dashboards por área (vendas, atendimento, marketing, operações), exportações agendadas, coortes, funil.
- **Financeiro avançado**: contas a pagar/receber, fluxo de caixa projetado, DRE, centros de custo, comissões, metas.
- **RH/Equipe**: escalas, ponto, metas, comissões, avaliações, comunicação interna.
- **Mídia**: DAM com organização, versões, uso por campanha.

## 7. 🟡 Fidelidade & CRM (forte na Cacau Show — "Cacau Lovers")

- **Programa de fidelidade** de verdade: pontos por compra, resgate, níveis/tiers, regras, expiração (`loyalty_accounts`/`loyalty_transactions` existem — falta motor e UI).
- **Clube de assinatura** (`subscriptions`/`memberships` existem): recorrência, cobrança, benefícios.
- **Cashback, cupons, gift cards**.
- **CRM**: automação de datas especiais (aniversário → cupom), régua de relacionamento, RFM, campanhas segmentadas, integração com os canais.

## 8. 🟡 Estoque & Operações avançadas

- **Estoque por unidade/depósito**, inventário/balanço, curva ABC, ponto de reposição automático, ordem de compra a fornecedor, recebimento.
- **Produção/ficha técnica** (chocolate, padaria, cafeteria): receitas, insumos, custo por produção, perdas, validade/lote (crítico para alimentos).
- **Rastreabilidade de lote e validade** (compliance alimentar/ANVISA).

## 9. 🟢 Qualidade, correção de bugs e infraestrutura

- **Bugs/UX conhecidos**: revisar todos os calendários/popovers (padrão glass), estados vazios, responsividade mobile do admin, e o warning de bundle > 500 kB (**code-splitting** por rota com `React.lazy`, hoje tudo num chunk de ~750 kB).
- **Testes**: não há testes automatizados. Introduzir testes de unidade (Vitest) e e2e (Playwright) nos fluxos críticos (PDV, checkout, auth).
- **Observabilidade**: monitoramento de erros (Sentry), logs das Edge Functions, healthchecks.
- **Performance**: índices no banco onde faltam, paginação (hoje vários `limit(500)`), cache.
- **CI/CD**: pipeline com lint + build + testes antes do deploy; hoje o deploy é direto no push.
- **Backup & retenção**: rotina de backup do Postgres, PITR, plano de recuperação.
- **Acessibilidade (a11y)** e **i18n** (há base de traduções/`translations`, PT/EN/ES no site — estender ao admin).
- **Documentação**: manual do lojista, base de ajuda, changelog.

## 10. Roadmap priorizado (sugestão de fases)

**Fase 1 — Fundamentos comerciais e segurança (bloqueia venda do SaaS)**
1. RBAC aplicado (nav + ações + policies por papel) e fluxo de convite de equipe.
2. Auth completa: cadastro self-service de tenant, reset de senha, verificação de e-mail, 2FA.
3. Pagamento no checkout da loja própria (Pix + cartão).

**Fase 2 — Fiscal e PDV completo (bloqueia varejo no Brasil)**
4. Emissão NFC-e/NF-e (provedor) + campos fiscais no produto.
5. TEF/Pix presencial no PDV + conciliação.

**Fase 3 — Omnichannel de verdade**
6. Sincronização real dos marketplaces (começar por Mercado Livre completo).
7. OMS unificado + etiqueta de envio + delivery (iFood).

**Fase 4 — Rede e retenção (diferencial vs Cacau Show)**
8. Franchising: multi-unidade, royalties, pedido B2B, auditoria de campo.
9. Fidelidade + clube de assinatura + CRM automatizado.

**Fase 5 — Profundidade e escala**
10. Aprofundar módulos placeholder (Conversas, Help Desk, Conhecimento, Analytics, Financeiro avançado).
11. Qualidade: testes, code-splitting, observabilidade, CI/CD, backup.

---

_Recomendação: atacar a Fase 1 antes de vender acesso a terceiros — sem RBAC aplicado e auth completa, um tenant compromete o dado do outro e qualquer membro tem poder total. Fiscal e pagamento (Fases 1–2) são o que separa um "sistema bonito" de um sistema que uma rede de varejo realmente adota._

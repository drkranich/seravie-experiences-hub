# Proposta de poda da navegação — Seravie Experiences

_Objetivo: sair de ~139 subpáginas conceituais para poucas páginas fortes. Regra: se é só um "modo" do mesmo dado, vira **filtro/aba** dentro de um painel; se não tem dado nem fluxo próprio, **remove**; se já existe painel real, **liga** a ele. Legenda: **✅ Manter** · **🔀 Fundir** · **🗑 Remover** · **🔌 Já ligado a painel real**._

---

## Núcleo

### Painel Executivo
- ✅ Dashboard Executivo (é o próprio Backstage)
- 🔌 Últimas Vendas → Vendas · Últimas Conversas → Conversas
- 🔀 Feed IA, Indicadores, Alertas, Pendências, Aprovações, Atividades → **abas do próprio Painel** (já mostramos alertas/feed lá). Não precisam ser páginas.
- 🗑 Agenda do Dia (já existe o módulo Agenda)

### Experience CRM
- ✅ Todos os Clientes (CRM 360) · 🔌 Leads, Empresas, VIP (auto)
- 🔀 LTV, Histórico, Jornada, Segmentações, Etiquetas → **abas/filtros dentro do CRM** (são recortes da mesma base)
- 🔀 Fidelidade, Datas Especiais, Preferências, Família → agrupar em uma aba **"Relacionamento"** no CRM
- 🗑 IA do Cliente (vira sugestão dentro do CRM quando ligar a IA)

### Central de Conversas
- ✅ Caixa Geral (inbox) · 🔌 Canais de Atendimento
- 🔀 WhatsApp, Instagram, Messenger, Telegram, Email, Chat Site, Google, Chamadas → **filtros de canal dentro do inbox** (uma caixa, filtra por canal). Não são 8 páginas.
- 🔀 Templates, Assinaturas → aba "Configurações" das Conversas · 🗑 IA Assistente (vira ação no inbox)

### Help Desk
- ✅ Chamados · 🔌 SLA, NPS, Auditoria, Base de Conhecimento
- 🔀 Prioridades, Categorias, Equipes, Escalonamentos → **abas de Configuração do Help Desk**
- 🗑 IA de Atendimento (ação futura da IA)

### Experiências
- 🔌 Catálogo → Catálogo · Eventos → Eventos · Presentes → frente Presentes
- 🔀 Jornadas, Pacotes, Datas, Assinaturas, Corporativo, Exclusivas, Calendário → 1 página **"Experiências"** com abas (hoje são 10 páginas conceituais)

### Marketing
- ✅ Campanhas · 🔌 Cupons, Formulários, Analytics, Automações
- 🔀 Email, WhatsApp, SMS, Redes Sociais → **canais dentro de Campanhas** (tipo de campanha, não página)
- 🔀 Segmentações → aba do CRM · Landing Pages → Site/Páginas · Fidelidade → CRM

### Operações
- ✅ Checklists · 🔌 Estoque, Equipamentos
- 🔀 Tarefas, Aprovações, Fluxos, Plano de Ação → 1 página **"Tarefas & Fluxos"** (arquétipo tarefa, com abas por etapa)
- 🔀 Auditorias, Não Conformidades → levam ao Help Desk/Operações de auditoria (arquétipo auditoria)
- 🔀 Manutenção → aba de Equipamentos · Documentos → Conhecimento · 🗑 IA Operacional

### Equipe
- ✅ Funcionários · 🔌 Metas, Permissões → Usuários & Acessos
- 🔀 Escalas, Treinamentos, Avaliações, Comunicação, Reconhecimentos → 1 página **"Gestão de Pessoas"** com abas
- 🔀 Comissões → Financeiro · Documentos → Conhecimento

### Conhecimento
- ✅ Biblioteca · 🔌 Cursos, FAQ
- 🔀 POPs, Procedimentos, Vídeos, Certificados, Versionamento → **abas da Biblioteca** (tipos de conteúdo)
- 🗑 IA, Pesquisa (a busca é transversal, não página)

### Mídia
- ✅ Biblioteca de Mídia (uma página com filtros por tipo)
- 🔀 Fotos, Vídeos, Logos, Campanhas, Artes, Templates, Documentos → **filtros da mesma biblioteca** · 🗑 IA Imagens, Organização Inteligente

### Financeiro
- 🔌 Receitas, Despesas, Indicadores, Dashboard → Financeiro · Contas a Pagar/Receber, DRE, Metas, Assinaturas → já ligados
- 🔀 Comissões → aba do Financeiro · 🗑 Integrações (fica na fase de pagamento)

### Analytics
- 🔌 Vendas, Clientes, Atendimento → auto
- 🔀 Marketing, Operações, Conversão, Heatmaps, Exportações → **abas do Analytics** · 🗑 IA Insights (futuro IA)

### Seravie AI & Automações
- Manter **1 página de IA** (chat + configurações) e **1 de Automações** (fluxos), com abas internas.
- 🗑 As ~18 subpáginas (Agentes, Sugestões, Prompt Center, Gatilhos, Condições, Webhooks, Histórico…) viram **abas** dessas duas páginas — ativadas quando ligar a chave de IA. Hoje só geram ruído.

---

## Site & Conteúdo
- ✅ Todas já têm painel real (Seções, Serviços, Portfólio, Processo, Segmentos, Jornal, Depoimentos, FAQ, Páginas, Menus, Newsletter). **Nada a podar.**

## Sistema
- ✅ Frentes/Núcleos, Usuários & Acessos, Minha Assinatura, Planos, Super Admin, Configurações. **Manter.**
- 🔀 Subpáginas de Configurações (Empresas, Canais, APIs, Webhooks, Segurança, Temas, Idiomas, Backup…) → **abas dentro de Configurações**, não páginas soltas.

---

## Resumo do impacto
- **De ~139 subpáginas → ~35–40 páginas fortes.**
- Cada "modo" (canal, tipo, recorte) vira **filtro/aba**, não página.
- Removidas as páginas de **IA/automação conceituais** (viram abas ativadas na fase de secrets).
- Nada que já é painel real ou tem dado próprio é removido.

## Como eu executaria (se aprovado)
1. **Ligar** (baixo risco): apontar as subpáginas 🔌 para os painéis reais que já existem.
2. **Fundir**: transformar grupos de subpáginas em **abas** de um painel só (CRM, Conversas, Help Desk, Conhecimento, Mídia, Experiências, IA, Automações, Configurações).
3. **Remover** do menu as puramente conceituais (o dado/board não se perde: continua acessível como aba).
4. Publicar por módulo, você validando a cada um.

_Nada é apagado do banco — a poda é só na navegação/experiência. Registros já criados continuam acessíveis nas abas correspondentes._

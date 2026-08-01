import { ResourcePanel } from './ResourcePanel'

const MODELS = { studio: 'Seravie Studio', experience_center: 'Experience Center', regional_hub: 'Regional Hub', signature: 'Signature Center' }
const LEVELS = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', signature: 'Signature' }

// ---- Expansão: candidatos / prospecção ----
export function ExpansaoPanel({ notify }) {
  const STAGE = { prospect: 'Prospecção', qualified: 'Qualificado', negotiation: 'Negociação', contract: 'Contrato', signed: 'Assinado', lost: 'Perdido' }
  return (
    <ResourcePanel notify={notify} module="expansao" table="franchise_leads" title="Expansão" subtitle="candidatos a franquia" icon="map" exportName="expansao"
      orderBy={{ column: 'created_at', ascending: false }}
      fields={[
        { key: 'name', label: 'Candidato', type: 'text', primary: true, required: true, full: true },
        { key: 'region', label: 'Região', type: 'text', chip: true },
        { key: 'segment', label: 'Segmento', type: 'text', chip: true },
        { key: 'model', label: 'Modelo de interesse', type: 'select', options: MODELS, chip: true, filter: true },
        { key: 'stage', label: 'Etapa', type: 'status', options: STAGE, default: 'prospect', filter: true },
        { key: 'investment', label: 'Investimento (R$)', type: 'currency' },
        { key: 'contact', label: 'Contato', type: 'text' },
        { key: 'phone', label: 'Telefone', type: 'text' },
        { key: 'email', label: 'E-mail', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Candidatos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Em negociação', calc: (r) => r.filter((x) => ['negotiation', 'contract'].includes(x.stage)).length, fmt: 'int' },
        { label: 'Assinados', calc: (r) => r.filter((x) => x.stage === 'signed').length, fmt: 'int' },
        { label: 'Pipeline (R$)', calc: (r) => r.filter((x) => x.stage !== 'lost').reduce((s, x) => s + Number(x.investment || 0), 0), fmt: 'currency' },
      ]}
    />
  )
}

// ---- Franqueados: unidades da rede ----
export function FranqueadosPanel({ notify }) {
  const STATUS = { prospect: 'Em implantação', active: 'Operando', paused: 'Pausada', closed: 'Encerrada' }
  return (
    <ResourcePanel notify={notify} module="franqueados" table="units" title="Franqueados" subtitle="unidades da rede" icon="building" exportName="franqueados"
      orderBy={{ column: 'name', ascending: true }} inject={{ status: 'active' }}
      fields={[
        { key: 'name', label: 'Unidade', type: 'text', primary: true, required: true, full: true },
        { key: 'model', label: 'Modelo', type: 'select', options: MODELS, default: 'studio', chip: true, filter: true },
        { key: 'owner_name', label: 'Franqueado(a)', type: 'text', chip: true },
        { key: 'region', label: 'Região', type: 'text', chip: true },
        { key: 'city', label: 'Cidade', type: 'text' },
        { key: 'state', label: 'UF', type: 'text' },
        { key: 'phone', label: 'Telefone', type: 'text' },
        { key: 'email', label: 'E-mail', type: 'text' },
        { key: 'opening_date', label: 'Inauguração', type: 'date' },
        { key: 'cert_level', label: 'Certificação', type: 'select', options: LEVELS },
        { key: 'status', label: 'Situação', type: 'status', options: STATUS, default: 'active', filter: true },
      ]}
      kpis={[
        { label: 'Unidades', calc: (r) => r.length, fmt: 'int' },
        { label: 'Operando', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        { label: 'Em implantação', calc: (r) => r.filter((x) => x.status === 'prospect').length, fmt: 'int' },
        { label: 'Signature', calc: (r) => r.filter((x) => x.model === 'signature').length, fmt: 'int' },
      ]}
    />
  )
}

// ---- Implantações ----
export function ImplantacoesPanel({ notify }) {
  const STAGE = { briefing: 'Briefing', arquitetura: 'Arquitetura', mobiliario: 'Mobiliário', equipamentos: 'Equipamentos', marketing: 'Marketing', inauguracao: 'Inauguração' }
  return (
    <ResourcePanel notify={notify} module="implantacoes" table="implementations" title="Implantações" subtitle="aberturas em andamento" icon="layout" exportName="implantacoes"
      orderBy={{ column: 'created_at', ascending: false }}
      fields={[
        { key: 'title', label: 'Projeto', type: 'text', primary: true, required: true, full: true, placeholder: 'Ex: Abertura Unidade Centro' },
        { key: 'unit_ref', label: 'Unidade', type: 'text', chip: true },
        { key: 'model', label: 'Modelo', type: 'select', options: MODELS, chip: true, filter: true },
        { key: 'stage', label: 'Etapa', type: 'status', options: STAGE, default: 'briefing', filter: true },
        { key: 'start_date', label: 'Início', type: 'date' },
        { key: 'deadline', label: 'Inauguração prevista', type: 'date' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Implantações', calc: (r) => r.length, fmt: 'int' },
        { label: 'Em arquitetura', calc: (r) => r.filter((x) => x.stage === 'arquitetura').length, fmt: 'int' },
        { label: 'Prontas p/ inaugurar', calc: (r) => r.filter((x) => x.stage === 'inauguracao').length, fmt: 'int' },
      ]}
    />
  )
}

// ---- Experience Standards ----
export function StandardsPanel({ notify }) {
  const CAT = { arquitetura: 'Arquitetura', iluminacao: 'Iluminação', aromas: 'Aromas', playlist: 'Playlist', uniformes: 'Uniformes', vitrine: 'Vitrine', atendimento: 'Atendimento', comunicacao: 'Comunicação', embalagem: 'Embalagem', sinalizacao: 'Sinalização', paisagismo: 'Paisagismo', fotografia: 'Fotografia', redes_sociais: 'Redes sociais', limpeza: 'Limpeza' }
  const STATUS = { draft: 'Rascunho', active: 'Vigente', archived: 'Arquivado' }
  return (
    <ResourcePanel notify={notify} module="standards" table="experience_standards" title="Experience Standards" subtitle="padrões oficiais da marca" icon="star" exportName="experience-standards"
      orderBy={{ column: 'created_at', ascending: false }} inject={{ status: 'active' }}
      fields={[
        { key: 'title', label: 'Padrão', type: 'text', primary: true, required: true, full: true },
        { key: 'category', label: 'Categoria', type: 'select', options: CAT, chip: true, filter: true },
        { key: 'segment', label: 'Segmento', type: 'text', chip: true },
        { key: 'model', label: 'Modelo de unidade', type: 'select', options: MODELS, chip: true, filter: true },
        { key: 'version', label: 'Versão', type: 'text', chip: true },
        { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
        { key: 'file_url', label: 'Arquivo/manual (URL)', type: 'text', full: true },
        { key: 'spec', label: 'Especificação', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Padrões', calc: (r) => r.length, fmt: 'int' },
        { label: 'Vigentes', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        { label: 'Categorias', calc: (r) => new Set(r.map((x) => x.category).filter(Boolean)).size, fmt: 'int' },
      ]}
    />
  )
}

// ---- Experience Certification ----
export function CertificationPanel({ notify }) {
  const STATUS = { pending: 'Pendente', certified: 'Certificada', failed: 'Reprovada', expired: 'Vencida' }
  return (
    <ResourcePanel notify={notify} module="certification" table="unit_certifications" title="Experience Certification" subtitle="auditorias e selos da rede" icon="check" exportName="certificacoes"
      orderBy={{ column: 'created_at', ascending: false }}
      fields={[
        { key: 'unit_id', label: 'Unidade', type: 'ref', refTable: 'units', refLabel: 'name', primary: true, chip: true, placeholder: '— selecione a unidade —' },
        { key: 'score', label: 'Pontuação (0–100)', type: 'int', chip: true },
        { key: 'level', label: 'Nível', type: 'select', options: LEVELS, default: 'bronze', chip: true, filter: true },
        { key: 'status', label: 'Situação', type: 'status', options: STATUS, default: 'pending', filter: true },
        { key: 'audited_at', label: 'Data da auditoria', type: 'date' },
        { key: 'valid_until', label: 'Validade do selo', type: 'date' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Auditorias', calc: (r) => r.length, fmt: 'int' },
        { label: 'Certificadas', calc: (r) => r.filter((x) => x.status === 'certified').length, fmt: 'int' },
        { label: 'Pontuação média', calc: (r) => { const v = r.filter((x) => x.score != null); return v.length ? Math.round(v.reduce((s, x) => s + x.score, 0) / v.length) : 0 }, fmt: 'int' },
        { label: 'Selos Ouro+', calc: (r) => r.filter((x) => x.status === 'certified' && ['ouro', 'signature'].includes(x.level)).length, fmt: 'int' },
      ]}
    />
  )
}

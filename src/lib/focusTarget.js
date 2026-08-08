// focusTarget — barramento de "foco" para deep-link do Ctrl+K.
//
// Quando o buscador abre um resultado de dado (um cliente, empresa, pedido,
// conversa), ele registra aqui o alvo { kind, id, raw } e navega. A tela de
// destino, ao montar, chama consumeFocus(kind) para pegar (e limpar) o alvo e
// abrir/focar aquele registro.
//
// É intencionalmente simples (variável de módulo + assinantes) e "one-shot":
// o alvo é consumido uma única vez, então não re-dispara em re-renders.

let _target = null           // { kind, id, raw, at }
const _subs = new Set()

// registra um alvo e notifica quem estiver ouvindo (best-effort).
export function setFocus(kind, id, raw = null) {
  if (!kind || !id) return
  _target = { kind, id, raw, at: Date.now() }
  _subs.forEach((fn) => { try { fn(_target) } catch { /* noop */ } })
}

// pega e LIMPA o alvo se for do tipo pedido (kind). Sem kind, pega qualquer um.
// Retorna null se não houver alvo compatível.
export function consumeFocus(kind = null) {
  if (!_target) return null
  if (kind && _target.kind !== kind) return null
  const t = _target
  _target = null
  return t
}

// só espia o alvo atual sem consumir.
export function peekFocus() { return _target }

// assina mudanças (retorna unsubscribe). Útil se a tela já estiver montada.
export function onFocus(fn) {
  _subs.add(fn)
  return () => _subs.delete(fn)
}

// mapeia a "fonte de dados" do palette para o kind + rota de destino.
export const FOCUS_ROUTE = {
  contacts: 'crm',
  companies: 'crm_companies',
  units: 'franchise',
  orders: 'pos',
  conversations: 'conversations',
}

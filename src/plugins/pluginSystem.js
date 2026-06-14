// Sistema de Plugins Extensível
const PLUGINS = new Map()

export class Plugin {
  constructor(name, version, hooks = {}) {
    this.name = name
    this.version = version
    this.hooks = hooks
    this.enabled = false
  }

  enable() {
    this.enabled = true
    console.log(`✓ Plugin ${this.name} habilitado`)
  }

  disable() {
    this.enabled = false
    console.log(`✗ Plugin ${this.name} desabilitado`)
  }
}

export function registerPlugin(plugin) {
  PLUGINS.set(plugin.name, plugin)
  console.log(`📦 Plugin registrado: ${plugin.name}@${plugin.version}`)
  return plugin
}

export function getPlugin(name) {
  return PLUGINS.get(name)
}

export function executeHook(hookName, data = {}) {
  const results = []

  for (const [name, plugin] of PLUGINS) {
    if (!plugin.enabled || !plugin.hooks[hookName]) continue

    try {
      const result = plugin.hooks[hookName](data)
      results.push({ plugin: name, result, error: null })
    } catch (error) {
      results.push({ plugin: name, result: null, error })
    }
  }

  return results
}

// Exemplo de Plugins
export const analyticsPlugin = new Plugin(
  'analytics',
  '1.0.0',
  {
    'page:load': (data) => {
      console.log('Analytics: Page loaded', data)
    },
    'form:submit': (data) => {
      console.log('Analytics: Form submitted', data)
    },
  }
)

export const notificationPlugin = new Plugin(
  'notifications',
  '1.0.0',
  {
    'form:submit': (data) => {
      console.log('Notification: Form submitted', data)
    },
    'contact:received': (data) => {
      console.log('Notification: Contact received', data)
    },
  }
)

export const seoPlugin = new Plugin(
  'seo',
  '1.0.0',
  {
    'page:load': (data) => {
      console.log('SEO: Updating meta tags', data)
    },
  }
)

// i18n Configuration
export const languages = {
  pt: { name: 'Português', flag: '🇧🇷' },
  en: { name: 'English', flag: '🇺🇸' },
  es: { name: 'Español', flag: '🇪🇸' },
  fr: { name: 'Français', flag: '🇫🇷' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
}

export const translations = {
  pt: {
    home: {
      title: 'Experiências Premium',
      subtitle: 'Transformando visões em realidade',
      cta: 'Começar Agora',
    },
    services: {
      title: 'Nossos Serviços',
      consulting: 'Consultoria Estratégica',
      design: 'Design de Experiência',
      development: 'Desenvolvimento Web',
    },
    contact: {
      title: 'Entre em Contato',
      name: 'Seu Nome',
      email: 'Seu Email',
      message: 'Sua Mensagem',
      submit: 'Enviar',
      success: 'Mensagem enviada com sucesso!',
    },
  },
  en: {
    home: {
      title: 'Premium Experiences',
      subtitle: 'Turning visions into reality',
      cta: 'Get Started',
    },
    services: {
      title: 'Our Services',
      consulting: 'Strategic Consulting',
      design: 'Experience Design',
      development: 'Web Development',
    },
    contact: {
      title: 'Get In Touch',
      name: 'Your Name',
      email: 'Your Email',
      message: 'Your Message',
      submit: 'Send',
      success: 'Message sent successfully!',
    },
  },
  es: {
    home: {
      title: 'Experiencias Premium',
      subtitle: 'Convirtiendo visiones en realidad',
      cta: 'Comenzar',
    },
    services: {
      title: 'Nuestros Servicios',
      consulting: 'Consultoría Estratégica',
      design: 'Diseño de Experiencia',
      development: 'Desarrollo Web',
    },
    contact: {
      title: 'Contáctenos',
      name: 'Su Nombre',
      email: 'Su Email',
      message: 'Su Mensaje',
      submit: 'Enviar',
      success: '¡Mensaje enviado exitosamente!',
    },
  },
}

export function getTranslation(lang, key) {
  const keys = key.split('.')
  let value = translations[lang] || translations.pt

  for (const k of keys) {
    value = value[k]
    if (!value) break
  }

  return value || key
}

export function detectLanguage() {
  const saved = localStorage.getItem('seravie_language')
  if (saved) return saved

  const browserLang = navigator.language.split('-')[0]
  return Object.keys(languages).includes(browserLang) ? browserLang : 'pt'
}

export function setLanguage(lang) {
  localStorage.setItem('seravie_language', lang)
  document.documentElement.lang = lang
}

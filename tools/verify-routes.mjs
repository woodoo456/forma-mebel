import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const memory = new Map()
const storage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
}

Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'ru-RU', clipboard: { writeText: async () => {} } } })
globalThis.localStorage = storage
globalThis.sessionStorage = storage
globalThis.document = {
  body: { style: {} },
  documentElement: { lang: 'ru' },
  getElementById: () => null,
  querySelector: () => null,
}
globalThis.window = {
  location: { hash: '#/ru', pathname: '/forma-mebel/', search: '', href: 'http://localhost/forma-mebel/#/ru' },
  history: { state: null, replaceState: () => {} },
  innerHeight: 900,
  innerWidth: 1440,
  matchMedia: () => ({ matches: false }),
  addEventListener: () => {},
  removeEventListener: () => {},
  scrollTo: () => {},
  setTimeout,
  clearTimeout,
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const { default: App, formatPhone, getPhoneDigits } = await vite.ssrLoadModule('/src/App.tsx')

const phoneCases = [
  ['87771234567', '+7 (777) 123-45-67'],
  ['+7 701 222 33 44', '+7 (701) 222-33-44'],
  ['77012223344', '+7 (701) 222-33-44'],
]
for (const [input, expected] of phoneCases) {
  if (formatPhone(input) !== expected || getPhoneDigits(input).length !== 10) {
    console.error(`FAIL phone ${input}`)
    process.exitCode = 1
  }
}
console.log('OK phone normalization (+7, 7, 8)')

const cases = [
  ['#/works', 'Работы'],
  ['#/ru', 'Кухни, шкафы и гардеробные на заказ'],
  ['#/ru/services?section=kitchens', 'Материалы и фурнитура'],
  ['#/ru/works?category=wardrobes', 'Шкаф в прихожую с нишей'],
  ['#/ru/prices', 'Демонстрационные цены, не действующее предложение'],
  ['#/ru/about', 'Как организована работа'],
  ['#/ru/contacts?type=closets', 'Обсудить заказ'],
  ['#/ru/works/oqu-kitchen', 'Светлая кухня с высокими шкафами'],
  ['#/ru/not-a-page', 'Страница не найдена'],
  ['#/kk', 'Тапсырыспен асүйлер, шкафтар және киім бөлмелері'],
  ['#/kk/services?section=closets', 'Материалдар мен фурнитура'],
  ['#/kk/works?category=kitchens', 'Аралы бар графит түсті асүй'],
  ['#/kk/prices', 'Демонстрациялық бағалар, қолданыстағы ұсыныс емес'],
  ['#/kk/about', 'Жұмыс қалай ұйымдастырылады'],
  ['#/kk/contacts?type=kitchens', 'Тапсырысты талқылау'],
  ['#/kk/works/saule-closet', 'Шыны қасбеттері бар киім бөлмесі'],
  ['#/kk/not-a-page', 'Бет табылмады'],
]

let failed = 0
const renderHash = hash => {
  window.location.hash = hash
  window.location.href = `http://localhost/forma-mebel/${hash}`
  return renderToStaticMarkup(React.createElement(App))
}

for (const [hash, expected] of cases) {
  const html = renderHash(hash)
  const desktopNavigation = html.match(/<nav class="desktop-nav"[^>]*>(.*?)<\/nav>/)?.[1] ?? ''
  const navigationLinks = desktopNavigation.match(/<a /g)?.length ?? 0
  const ok = html.includes(expected) && navigationLinks === 6
  console.log(`${ok ? 'OK' : 'FAIL'} ${hash}`)
  if (!ok) failed += 1
}

const focusedChecks = [
  ['home has three compact cards', () => (renderHash('#/ru').match(/class="project-card project-card-compact"/g) ?? []).length === 3],
  ['compact cards omit specifications', () => [...renderHash('#/ru').matchAll(/<article class="project-card project-card-compact">(.*?)<\/article>/g)].every(match => !match[1].includes('<dl>'))],
  ['full works catalog keeps nine cards', () => (renderHash('#/ru/works').match(/class="project-card"/g) ?? []).length === 9],
  ['services use category-specific actions', () => ['Посмотреть кухни', 'Посмотреть шкафы', 'Посмотреть гардеробные', 'Обсудить кухню', 'Обсудить шкаф', 'Обсудить гардеробную'].every(text => renderHash('#/ru/services').includes(text))],
  ['price examples precede factors', () => { const html = renderHash('#/ru/prices'); return html.indexOf('Примеры комплектаций') < html.indexOf('Что влияет на стоимость') }],
  ['order process contains delivery and installation', () => renderHash('#/ru').includes('Доставка и установка') && renderHash('#/kk').includes('Жеткізу және орнату')],
]

for (const [name, check] of focusedChecks) {
  const ok = check()
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}`)
  if (!ok) failed += 1
}

await vite.close()
if (failed) process.exitCode = 1

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { categories, categoryLabels, getProjects, projects, serviceData, type Category, type Lang, type Project } from './data'
import { getCopy } from './i18n'
import { priceExamples } from './pricing'

type Route = { lang: Lang; path: string; query: URLSearchParams }
type NavItem = { path: string; label: string }

function parseRoute(): Route {
  const raw = window.location.hash.slice(1)
  const [pathPart = '', queryPart = ''] = raw.split('?')
  const parts = pathPart.split('/').filter(Boolean)
  const stored = localStorage.getItem('forma-lang')
  const fallback: Lang = stored === 'ru' || stored === 'kk' ? stored : navigator.language.toLowerCase().startsWith('kk') ? 'kk' : 'ru'
  const lang: Lang = parts[0] === 'ru' || parts[0] === 'kk' ? parts[0] : fallback
  const routeParts = parts[0] === 'ru' || parts[0] === 'kk' ? parts.slice(1) : parts
  const path = `/${routeParts.join('/')}`.replace(/\/$/, '') || '/'
  return { lang, path, query: new URLSearchParams(queryPart) }
}

function useRoute() {
  const [route, setRoute] = useState<Route>(parseRoute)
  useEffect(() => {
    const sync = () => setRoute(parseRoute())
    window.addEventListener('hashchange', sync)
    if (!/^#\/(ru|kk)(\/|$)/.test(window.location.hash)) {
      const query = route.query.size ? `?${route.query.toString()}` : ''
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${pathFor(route.lang, `${route.path}${query}`)}`)
      sync()
    }
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return route
}

function pathFor(lang: Lang, path: string) {
  return `#/${lang}${path === '/' ? '' : path}`
}

function imagePath(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

function ArrowIcon({ direction = 'right' }: { direction?: 'right' | 'left' }) {
  return <svg className={direction === 'left' ? 'icon-left' : ''} aria-hidden="true" viewBox="0 0 20 20"><path d="M4 10h12M11 5l5 5-5 5" /></svg>
}

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7 5 5 5-5" /></svg>
}

function LinkButton({ lang, to, children, className = 'text-link', onClick }: { lang: Lang; to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  return <a href={pathFor(lang, to)} className={className} onClick={onClick}>{children}<ArrowIcon /></a>
}

function getNavigation(lang: Lang): NavItem[] {
  const c = getCopy(lang)
  return [
    { path: '/', label: c.nav.home },
    { path: '/services', label: c.nav.services },
    { path: '/works', label: c.nav.works },
    { path: '/prices', label: c.nav.prices },
    { path: '/about', label: c.nav.about },
    { path: '/contacts', label: c.nav.contacts },
  ]
}

function LanguageSwitch({ route, compact = false, onSelect }: { route: Route; compact?: boolean; onSelect?: () => void }) {
  const alternate: Lang = route.lang === 'ru' ? 'kk' : 'ru'
  const query = route.query.size ? `?${route.query.toString()}` : ''
  return <div className={`lang-switch${compact ? ' compact' : ''}`} aria-label={route.lang === 'ru' ? 'Выбор языка' : 'Тілді таңдау'}>
    <span aria-current="true">{route.lang === 'ru' ? 'РУС' : 'ҚАЗ'}</span>
    <a href={pathFor(alternate, `${route.path}${query}`)} onClick={onSelect} aria-label={alternate === 'ru' ? 'Русская версия' : 'Қазақша нұсқа'}>{alternate === 'ru' ? 'РУС' : 'ҚАЗ'}</a>
  </div>
}

function Header({ route }: { route: Route }) {
  const c = getCopy(route.lang)
  const navigation = getNavigation(route.lang)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeMenu = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }
  const isActive = (path: string) => path === '/' ? route.path === '/' : route.path === path || route.path.startsWith(`${path}/`)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('.mobile-nav a')?.focus())
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true)
      if (event.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLElement>('a, button')]
        const first = items[0]
        const last = items.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    const onResize = () => { if (window.innerWidth >= 1040) setOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  useEffect(() => setOpen(false), [route.path])

  const menu = open ? createPortal(
    <div className="menu-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeMenu(true) }}>
      <div className="mobile-panel" id="mobile-menu" ref={panelRef} role="dialog" aria-modal="true" aria-label={c.footer.nav}>
        <div className="mobile-panel-top">
          <a className="brand" href={pathFor(route.lang, '/')} onClick={() => closeMenu()}><span>FORMA</span><small>Mebel</small></a>
          <button className="menu-close" type="button" onClick={() => closeMenu(true)} aria-label={c.nav.close}><span /><span /></button>
        </div>
        <nav className="mobile-nav">{navigation.map(item => <a key={item.path} href={pathFor(route.lang, item.path)} aria-current={isActive(item.path) ? 'page' : undefined} onClick={() => closeMenu()}><span>{item.label}</span><ArrowIcon /></a>)}</nav>
        <div className="mobile-panel-bottom"><LanguageSwitch route={route} onSelect={() => closeMenu()} /><LinkButton lang={route.lang} to="/contacts" className="button button-dark" onClick={() => closeMenu()}>{c.nav.discuss}</LinkButton></div>
      </div>
    </div>, document.body,
  ) : null

  return <>
    <header className="site-header"><div className="header-inner shell">
      <a className="brand" href={pathFor(route.lang, '/')} aria-label={`${c.nav.home} — FORMA Mebel`}><span>FORMA</span><small>Mebel</small></a>
      <nav className="desktop-nav" aria-label={c.footer.nav}>{navigation.map(item => <a key={item.path} href={pathFor(route.lang, item.path)} aria-current={isActive(item.path) ? 'page' : undefined}>{item.label}</a>)}</nav>
      <div className="header-actions"><LanguageSwitch route={route} compact /><LinkButton lang={route.lang} to="/contacts" className="header-cta">{c.nav.discuss}</LinkButton><button ref={triggerRef} className="menu-trigger" type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? c.nav.close : c.nav.menu} onClick={() => setOpen(value => !value)}><span /><span /></button></div>
    </div></header>{menu}
  </>
}

function Footer({ lang }: { lang: Lang }) {
  const c = getCopy(lang)
  const navigation = getNavigation(lang)
  return <footer className="site-footer"><div className="shell footer-grid">
    <div className="footer-brand-block"><div className="brand footer-brand"><span>FORMA</span><small>Mebel</small></div><p>{c.footer.note}</p></div>
    <div><h2>{c.footer.nav}</h2>{navigation.map(item => <a key={item.path} href={pathFor(lang, item.path)}>{item.label}</a>)}</div>
    <div><h2>{c.footer.services}</h2>{categories.map(category => <a key={category} href={pathFor(lang, `/services?section=${category}`)}>{serviceData[category].title[lang]}</a>)}</div>
    <div className="footer-demo"><p>{c.footer.demo}</p></div>
  </div></footer>
}

function PageIntro({ title, lead, compact = false }: { title: string; lead: string; compact?: boolean }) {
  return <header className={`page-intro shell${compact ? ' compact' : ''}`}><h1>{title}</h1><p>{lead}</p></header>
}

function SectionTitle({ title, lead, action }: { title: string; lead?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{lead && <p>{lead}</p>}</div>{action}</div>
}

function ServiceCards({ lang }: { lang: Lang }) {
  const c = getCopy(lang)
  return <div className="home-service-grid">{categories.map(category => {
    const service = serviceData[category]
    return <article className="home-service-card" key={category}>
      <a className="home-service-image" href={pathFor(lang, `/services?section=${category}`)}><img src={imagePath(service.image)} alt={`${service.title[lang]} — ${service.intro[lang]}`} width="720" height="540" loading="lazy" /></a>
      <div><h3>{service.title[lang]}</h3><p>{service.intro[lang]}</p><LinkButton lang={lang} to={`/services?section=${category}`}>{c.common.more}</LinkButton></div>
    </article>
  })}</div>
}

type WorksReturn = { lang: Lang; category: Category | 'all'; y: number; slug: string; url: string }
function rememberWorks(project: Project, lang: Lang, category: Category | undefined) {
  const state: WorksReturn = { lang, category: category || 'all', y: window.scrollY, slug: project.slug, url: `/works${category ? `?category=${category}` : ''}` }
  sessionStorage.setItem('forma-works-return', JSON.stringify(state))
  window.history.replaceState({ ...window.history.state, worksScroll: state }, '', window.location.href)
}

function ProjectCard({ project, lang, filter, priority = false, compact = false, fromWorks = false }: { project: Project; lang: Lang; filter?: Category; priority?: boolean; compact?: boolean; fromWorks?: boolean }) {
  const c = getCopy(lang)
  const onOpen = () => {
    if (fromWorks) rememberWorks(project, lang, filter)
    else sessionStorage.removeItem('forma-works-return')
  }
  return <article className={`project-card${compact ? ' project-card-compact' : ''}`}>
    <a className="project-image" href={pathFor(lang, `/works/${project.slug}`)} onClick={onOpen} aria-label={`${c.worksPage.details}: ${project.title[lang]}`}><img src={imagePath(project.image)} alt={`${project.title[lang]} — ${project.summary[lang]}`} width="960" height="720" loading={priority ? 'eager' : 'lazy'} /></a>
    <div className="project-card-copy">{!compact && <span>{categoryLabels[project.category][lang]}</span>}<h3>{project.title[lang]}</h3>{!compact && <dl><div><dt>{c.common.dimensions}</dt><dd>{project.dimensions[lang]}</dd></div><div><dt>{c.common.materials}</dt><dd>{project.materials[lang]}</dd></div></dl>}<LinkButton lang={lang} to={`/works/${project.slug}`} onClick={onOpen}>{c.worksPage.details}</LinkButton></div>
  </article>
}

function scrollToForm() {
  document.getElementById('project-form')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}

type SelectOption = { value: string; label: string }
function CustomSelect({ id, label, value, options, placeholder, onChange }: { id: string; label: string; value: string; options: SelectOption[]; placeholder: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.value === value)
  useEffect(() => {
    const onOutside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])
  const openMenu = () => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (rect) setDropUp(window.innerHeight - rect.bottom < 250 && rect.top > window.innerHeight - rect.bottom)
    setActive(Math.max(0, options.findIndex(option => option.value === value)))
    setOpen(true)
  }
  const choose = (index: number) => { onChange(options[index].value); setActive(index); setOpen(false) }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (!open) {
        openMenu()
        if (event.key === 'ArrowUp' || event.key === 'End') setActive(options.length - 1)
        else setActive(0)
      } else if (event.key === 'Home') setActive(0)
      else if (event.key === 'End') setActive(options.length - 1)
      else setActive(index => event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length)
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) { event.preventDefault(); choose(active) }
  }
  return <div className={`field custom-select${dropUp ? ' drop-up' : ''}`} ref={rootRef}>
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
    <button id={id} type="button" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label ${id}`} aria-activedescendant={open ? `${id}-option-${active}` : undefined} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={onKeyDown}><span className={selected ? '' : 'placeholder'}>{selected?.label || placeholder}</span><span className="select-chevron"><ChevronIcon /></span></button>
    {open && <ul role="listbox" aria-labelledby={`${id}-label`}>{options.map((option, index) => <li id={`${id}-option-${index}`} key={option.value} role="option" aria-selected={value === option.value} className={index === active ? 'active' : ''} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}><span>{option.label}</span>{value === option.value && <strong aria-hidden="true">✓</strong>}</li>)}</ul>}
  </div>
}

export function getPhoneDigits(raw: string) {
  let digits = raw.replace(/\D/g, '')
  if (raw.trim().startsWith('+7')) digits = digits.slice(1)
  else if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) digits = digits.slice(1)
  return digits.slice(0, 10)
}

export function formatPhone(raw: string) {
  const digits = getPhoneDigits(raw)
  if (!digits) return ''
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)]
  let result = '+7'
  if (parts[0]) result += ` (${parts[0]}${parts[0].length === 3 ? ')' : ''}`
  if (parts[1]) result += ` ${parts[1]}`
  if (parts[2]) result += `-${parts[2]}`
  if (parts[3]) result += `-${parts[3]}`
  return result
}

function ProjectForm({ lang, initialType, projectName }: { lang: Lang; initialType?: Category; projectName?: string }) {
  const c = getCopy(lang)
  const [type, setType] = useState<Category | ''>(initialType || '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [wishes, setWishes] = useState('')
  const [size, setSize] = useState('')
  const [material, setMaterial] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState(false)
  const [copied, setCopied] = useState(false)
  const typeRef = useRef<HTMLButtonElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (initialType) setType(initialType) }, [initialType])
  const phoneError = (raw: string) => {
    const digits = getPhoneDigits(raw)
    if (!digits.length) return c.form.errors.phoneEmpty
    if (digits.length < 10) return c.form.errors.phoneIncomplete
    if (!/^[67]\d{9}$/.test(digits)) return c.form.errors.phoneInvalid
    return ''
  }

  const values = useMemo(() => {
    const rows = [
      projectName ? [c.form.project, projectName] : null,
      type ? [c.form.type, c.form.types[type]] : null,
      [c.form.name, name.trim()], [c.form.phone, formatPhone(phone)],
      wishes.trim() ? [c.form.wishes, wishes.trim()] : null,
      size.trim() ? [c.form.size, size.trim()] : null,
      material ? [c.form.material, c.form.materialOptions[Number(material)]] : null,
    ]
    return rows.filter(Boolean) as string[][]
  }, [c, material, name, phone, projectName, size, type, wishes])

  const validate = (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!type) next.type = c.form.errors.type
    if (!name.trim()) next.name = c.form.errors.name
    const phoneMessage = phoneError(phone)
    if (phoneMessage) next.phone = phoneMessage
    setErrors(next)
    if (Object.keys(next).length) {
      requestAnimationFrame(() => (next.type ? typeRef.current : next.name ? nameRef.current : phoneRef.current)?.focus())
      return
    }
    setPhone(formatPhone(phone)); setResult(true); setCopied(false)
  }
  const pastePhone = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    if (pasted.replace(/\D/g, '').length >= 10) { event.preventDefault(); const next = formatPhone(pasted); setPhone(next); setErrors(current => ({ ...current, phone: current.phone ? phoneError(next) : '' })) }
  }
  const copyResult = async () => {
    const text = [c.form.result, ...values.map(([label, value]) => `${label}: ${value}`)].join('\n')
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2200) } catch { setCopied(false) }
  }

  return <section className="order-section" id="project-form"><div className="shell order-layout">
    <div className="order-heading"><h2>{c.form.title}</h2><p>{c.form.lead}</p>{projectName && <div className="project-context"><span>{c.form.project}</span><strong>{projectName}</strong></div>}</div>
    <div className="order-card">
      {result ? <div className="application-result" aria-live="polite"><h3>{c.form.result}</h3><dl>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="result-demo">{c.form.demo}</p><div className="result-actions"><button className="button button-dark" type="button" onClick={copyResult}>{copied ? c.form.copied : c.form.copy}</button><button className="button button-secondary" type="button" onClick={() => setResult(false)}>{c.form.edit}</button></div></div> :
      <form onSubmit={validate} noValidate>
        <fieldset className="type-field" aria-invalid={!!errors.type} aria-describedby={errors.type ? 'type-error' : undefined}><legend>{c.form.type}</legend><div className="type-options">{categories.map((category, index) => <button ref={index === 0 ? typeRef : undefined} type="button" key={category} aria-pressed={type === category} onClick={() => { setType(category); setErrors(current => ({ ...current, type: '' })) }}><span>{c.form.types[category]}</span><small>{serviceData[category].intro[lang].split('.')[0]}</small></button>)}</div>{errors.type && <span className="field-error" id="type-error">{errors.type}</span>}</fieldset>
        <div className="primary-fields"><div className="field"><label htmlFor="order-name">{c.form.name}</label><input ref={nameRef} id="order-name" value={name} className={errors.name ? 'invalid' : ''} autoComplete="name" placeholder={c.form.namePlaceholder} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} onChange={event => { const next = event.target.value; setName(next); setErrors(current => ({ ...current, name: current.name && !next.trim() ? c.form.errors.name : '' })) }} />{errors.name && <span className="field-error" id="name-error">{errors.name}</span>}</div><div className="field"><label htmlFor="order-phone">{c.form.phone}</label><input ref={phoneRef} id="order-phone" value={phone} className={errors.phone ? 'invalid' : ''} inputMode="tel" autoComplete="tel" placeholder={c.form.phonePlaceholder} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-error' : undefined} onPaste={pastePhone} onBlur={() => { if (getPhoneDigits(phone).length) setPhone(formatPhone(phone)) }} onChange={event => { const next = event.target.value.replace(/[^\d+()\s-]/g, '').slice(0, 24); setPhone(next); setErrors(current => ({ ...current, phone: current.phone ? phoneError(next) : '' })) }} />{errors.phone && <span className="field-error" id="phone-error">{errors.phone}</span>}</div></div>
        <div className="field"><label htmlFor="order-wishes">{c.form.wishes} <small>— {c.form.optional}</small></label><textarea id="order-wishes" value={wishes} rows={3} placeholder={c.form.wishesPlaceholder} onChange={event => setWishes(event.target.value)} /></div>
        <details className="form-details"><summary>{c.form.details}<ChevronIcon /></summary><div className="detail-fields"><div className="field"><label htmlFor="order-size">{c.form.size}</label><input id="order-size" value={size} placeholder={c.form.sizePlaceholder} onChange={event => setSize(event.target.value)} /></div><CustomSelect id="order-material" label={c.form.material} value={material} placeholder={c.form.materialPlaceholder} onChange={setMaterial} options={c.form.materialOptions.map((label, index) => ({ value: String(index), label }))} /></div></details>
        <div className="submit-row"><button className="button button-dark" type="submit">{c.form.submit}<ArrowIcon /></button><p>{c.form.demo}</p></div>
      </form>}
    </div>
  </div></section>
}

function HomePage({ lang }: { lang: Lang }) {
  const c = getCopy(lang)
  const featured = [projects[0], projects[4], projects[8]]
  return <main>
    <section className="hero"><img className="hero-image" src={imagePath('/images/hero-forma.webp')} alt={lang === 'ru' ? 'Кухня с островом и шкафами из дерева' : 'Аралы және ағаш шкафтары бар асүй'} width="1920" height="1080" fetchPriority="high" /><div className="hero-overlay" /><div className="hero-content shell"><span>{c.home.kicker}</span><h1>{c.home.title}</h1><p>{c.home.lead}</p><div className="button-row"><LinkButton lang={lang} to="/works" className="button button-light">{c.common.viewWorks}</LinkButton><button type="button" className="button button-outline" onClick={scrollToForm}>{c.common.discuss}</button></div></div></section>
    <section className="section shell"><SectionTitle title={c.home.servicesTitle} lead={c.home.servicesLead} /><ServiceCards lang={lang} /></section>
    <section className="section tinted"><div className="shell"><SectionTitle title={c.home.examplesTitle} lead={c.home.examplesLead} /><div className="project-grid home-projects">{featured.map((project, index) => <ProjectCard key={project.slug} project={project} lang={lang} priority={index < 2} compact />)}</div><div className="works-all-action"><LinkButton lang={lang} to="/works" className="button button-dark">{c.common.allWorks}</LinkButton></div></div></section>
    <section className="section shell cost-section"><div><h2>{c.home.costTitle}</h2><p>{c.home.costText}</p><LinkButton lang={lang} to="/prices">{c.home.pricesLink}</LinkButton></div><ul>{c.home.costFactors.map((factor, index) => <li key={factor}><span>0{index + 1}</span>{factor}</li>)}</ul></section>
    <section className="section dark-section"><div className="shell"><SectionTitle title={c.home.processTitle} /><div className="process-grid">{c.home.steps.map((step, index) => <article key={step.title}><span>0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></div></section>
    <section className="section shell faq-section"><SectionTitle title={c.home.faqTitle} /><div className="faq-list">{c.home.faqs.map(item => <details key={item.q}><summary>{item.q}<span>+</span></summary><p>{item.a}</p></details>)}</div></section>
    <ProjectForm lang={lang} />
  </main>
}

function ServicesPage({ lang, section }: { lang: Lang; section?: string | null }) {
  const c = getCopy(lang)
  useEffect(() => {
    if (!section || (!categories.includes(section as Category) && section !== 'materials')) return
    window.setTimeout(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }), 0)
  }, [section])
  return <main><PageIntro title={c.services.title} lead={c.services.lead} />
    <div className="services-list shell">{categories.map((category, index) => {
      const service = serviceData[category]
      return <section className={`service-section${index % 2 ? ' reverse' : ''}`} id={category} key={category}><div className="service-photo"><img src={imagePath(service.image)} alt={`${service.title[lang]} — ${service.intro[lang]}`} width="1000" height="760" fetchPriority={index === 0 ? 'high' : undefined} loading={index ? 'lazy' : 'eager'} /></div><div className="service-copy"><h2>{service.title[lang]}</h2><p className="service-lead">{service.intro[lang]}</p><div className="service-columns"><div><h3>{c.common.select}</h3><ul>{service.choices[lang].map(item => <li key={item}>{item}</li>)}</ul></div><div><h3>{c.common.needed}</h3><ul>{service.needed[lang].map(item => <li key={item}>{item}</li>)}</ul></div></div><div className="service-actions"><LinkButton lang={lang} to={`/works?category=${category}`}>{c.services.worksByType[category]}</LinkButton><LinkButton lang={lang} to={`/contacts?type=${category}`} className="button button-dark">{c.services.orderType[category]}</LinkButton></div></div></section>
    })}</div>
    <section className="section tinted" id="materials"><div className="shell"><SectionTitle title={c.services.materialsTitle} lead={c.services.materialsLead} /><div className="info-grid">{c.services.materials.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></div></section>
    <section className="section shell"><SectionTitle title={c.services.productionTitle} /><div className="production-list">{c.services.production.map((item, index) => <article key={item.title}><span>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div></section>
  </main>
}

function WorksPage({ lang, query }: { lang: Lang; query: URLSearchParams }) {
  const c = getCopy(lang)
  const requested = query.get('category')
  const category = categories.includes(requested as Category) ? requested as Category : undefined
  const shown = getProjects(category)
  useLayoutEffect(() => {
    let restore = window.history.state?.worksScroll as WorksReturn | undefined
    const pending = sessionStorage.getItem('forma-pending-work-return')
    if (pending) { try { restore = JSON.parse(pending) as WorksReturn } catch { /* ignore invalid local state */ } sessionStorage.removeItem('forma-pending-work-return') }
    if (restore && restore.lang === lang && restore.category === (category || 'all')) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: restore!.y, behavior: 'auto' })))
  }, [category, lang])
  return <main><PageIntro title={c.worksPage.title} lead={c.worksPage.lead} compact /><section className="works-section shell"><div className="filters" aria-label={c.worksPage.title}><a href={pathFor(lang, '/works')} aria-current={!category ? 'true' : undefined}>{c.worksPage.all}<span>{projects.length}</span></a>{categories.map(item => <a key={item} href={pathFor(lang, `/works?category=${item}`)} aria-current={category === item ? 'true' : undefined}>{categoryLabels[item][lang]}<span>{getProjects(item).length}</span></a>)}</div><p className="works-note">{c.worksPage.demo}</p><div className="project-grid">{shown.map((project, index) => <ProjectCard key={project.slug} project={project} lang={lang} filter={category} priority={index < 2} fromWorks />)}</div></section></main>
}

function ProjectPage({ lang, project }: { lang: Lang; project: Project }) {
  const c = getCopy(lang)
  let returnState: WorksReturn | undefined
  try { const stored = sessionStorage.getItem('forma-works-return'); if (stored) returnState = JSON.parse(stored) } catch { /* ignore invalid local state */ }
  const canReturn = returnState?.lang === lang && returnState.slug === project.slug
  const backPath = canReturn ? returnState!.url : '/works'
  const setRestore = () => { if (canReturn) sessionStorage.setItem('forma-pending-work-return', JSON.stringify(returnState)) }
  const related = projects.filter(item => item.category !== project.category || item.slug !== project.slug).filter(item => item.slug !== project.slug).slice(0, 3)
  return <main><article className="project-page shell">
    <a className="back-link" href={pathFor(lang, backPath)} onClick={setRestore}><ArrowIcon direction="left" />{c.common.backWorks}</a>
    <nav className="breadcrumbs" aria-label={lang === 'ru' ? 'Хлебные крошки' : 'Навигациялық жол'}><a href={pathFor(lang, '/')}>{c.common.home}</a><span>/</span><a href={pathFor(lang, '/works')}>{c.common.works}</a><span>/</span><span aria-current="page">{project.title[lang]}</span></nav>
    <header className="project-heading"><div><span>{categoryLabels[project.category][lang]}</span><h1>{project.title[lang]}</h1></div><p>{project.summary[lang]}</p></header>
    <div className="project-cover"><img src={imagePath(project.image)} alt={`${project.title[lang]} — ${project.summary[lang]}`} width="1600" height="1067" fetchPriority="high" /></div>
    <div className="project-content"><section><h2>{c.project.descriptionTitle}</h2><p>{project.description[lang]}</p></section><section><h2>{c.project.specsTitle}</h2><dl className="spec-list"><div><dt>{c.common.category}</dt><dd>{categoryLabels[project.category][lang]}</dd></div><div><dt>{c.common.dimensions}</dt><dd>{project.dimensions[lang]}</dd></div><div><dt>{c.common.materials}</dt><dd>{project.materials[lang]}</dd></div></dl></section></div>
    <section className="project-features"><h2>{c.project.featuresTitle}</h2><ul>{project.features[lang].map(item => <li key={item}>{item}</li>)}</ul><LinkButton lang={lang} to={`/contacts?type=${project.category}&project=${project.slug}`} className="button button-dark">{c.project.want}</LinkButton></section>
  </article><section className="section tinted"><div className="shell"><SectionTitle title={c.project.similar} /><div className="project-grid related-projects">{related.map(item => <ProjectCard key={item.slug} project={item} lang={lang} />)}</div></div></section></main>
}

function PricesPage({ lang }: { lang: Lang }) {
  const c = getCopy(lang)
  const format = (amount: number) => new Intl.NumberFormat(lang === 'ru' ? 'ru-KZ' : 'kk-KZ').format(amount)
  return <main><PageIntro title={c.prices.title} lead={c.prices.lead} compact /><section className="section shell price-examples-section"><SectionTitle title={c.prices.examplesTitle} /><p className="price-disclaimer">{c.prices.demo}</p><div className="price-examples">{priceExamples.map(example => <article key={example.id}><div className="price-card-head"><span>{categoryLabels[example.category][lang]}</span><h3>{example.title[lang]}</h3><strong>{format(example.amount)} ₸</strong></div><dl><div><dt>{c.common.dimensions}</dt><dd>{example.dimensions[lang]}</dd></div><div><dt>{c.common.materials}</dt><dd>{example.materials[lang]}</dd></div></dl><div className="price-lists"><div><h4>{c.common.included}</h4><ul>{example.includes[lang].map(item => <li key={item}>{item}</li>)}</ul></div><div><h4>{c.common.excluded}</h4><ul>{example.excludes[lang].map(item => <li key={item}>{item}</li>)}</ul></div></div></article>)}</div></section><section className="section tinted"><div className="shell"><SectionTitle title={c.prices.factorsTitle} /><div className="price-factors">{c.prices.factors.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></div></section><section className="section estimate-section"><div className="shell estimate-grid"><div><h2>{c.prices.estimateTitle}</h2><ul>{c.prices.estimate.map(item => <li key={item}>{item}</li>)}</ul></div><div><h2>{c.prices.clarifyTitle}</h2><ul>{c.prices.clarify.map(item => <li key={item}>{item}</li>)}</ul></div></div></section><section className="compact-cta shell"><div><h2>{c.prices.ctaTitle}</h2><p>{c.prices.ctaText}</p></div><LinkButton lang={lang} to="/contacts" className="button button-dark">{c.common.discuss}</LinkButton></section></main>
}

function AboutPage({ lang }: { lang: Lang }) {
  const c = getCopy(lang)
  return <main><PageIntro title={c.about.title} lead={c.about.lead} /><section className="about-main shell"><div className="about-photo"><img src={imagePath('/images/project-wardrobe-open.webp')} alt={lang === 'ru' ? 'Шкаф с открытыми полками в интерьере' : 'Интерьердегі ашық сөрелері бар шкаф'} width="1000" height="750" fetchPriority="high" /></div><div><h2>{c.about.workTitle}</h2><p>{c.about.workText}</p></div></section><section className="section tinted"><div className="shell"><SectionTitle title={c.about.rolesTitle} /><div className="about-roles">{c.about.roles.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></div></section><section className="section shell about-bottom"><div><h2>{c.about.principlesTitle}</h2><ul>{c.about.principles.map(item => <li key={item}>{item}</li>)}</ul></div><aside><h2>{c.about.demoTitle}</h2><p>{c.about.demo}</p></aside></section></main>
}

function ContactsPage({ lang, query }: { lang: Lang; query: URLSearchParams }) {
  const c = getCopy(lang)
  const requested = query.get('type')
  const type = categories.includes(requested as Category) ? requested as Category : undefined
  const project = projects.find(item => item.slug === query.get('project'))
  return <main><PageIntro title={c.contacts.title} lead={c.contacts.lead} compact /><section className="contact-info shell"><div><h2>{c.contacts.nextTitle}</h2><ul>{c.contacts.next.map(item => <li key={item}>{item}</li>)}</ul></div><aside><h2>{c.contacts.contactsTitle}</h2><p>{c.contacts.contactsText}</p></aside></section><ProjectForm lang={lang} initialType={type || project?.category} projectName={project?.title[lang]} /></main>
}

function NotFound({ lang }: { lang: Lang }) {
  const c = getCopy(lang)
  return <main className="not-found shell"><span>404</span><div><h1>{c.notFound.title}</h1><p>{c.notFound.text}</p><LinkButton lang={lang} to="/" className="button button-dark">{c.common.home}</LinkButton></div></main>
}

function LegacyRedirect({ lang, path }: { lang: Lang; path: string }) {
  useLayoutEffect(() => { window.location.replace(pathFor(lang, path)) }, [lang, path])
  return null
}

function App() {
  const route = useRoute()
  const previousPath = useRef(route.path)
  useLayoutEffect(() => {
    if (previousPath.current !== route.path && route.path !== '/works') window.scrollTo({ top: 0, behavior: 'auto' })
    previousPath.current = route.path
  }, [route.path])
  useEffect(() => {
    localStorage.setItem('forma-lang', route.lang)
    document.documentElement.lang = route.lang
    const c = getCopy(route.lang)
    const project = route.path.startsWith('/works/') ? projects.find(item => item.slug === route.path.split('/')[2]) : undefined
    const titles: Record<string, string> = { '/': c.home.title, '/services': c.services.title, '/works': c.worksPage.title, '/prices': c.prices.title, '/about': c.about.title, '/contacts': c.contacts.title }
    const title = project?.title[route.lang] || titles[route.path] || c.notFound.title
    document.title = `${title} — FORMA Mebel`
    const descriptions: Record<string, string> = { '/': c.home.lead, '/services': c.services.lead, '/works': c.worksPage.lead, '/prices': c.prices.lead, '/about': c.about.lead, '/contacts': c.contacts.lead }
    document.querySelector('meta[name="description"]')?.setAttribute('content', project?.summary[route.lang] || descriptions[route.path] || c.footer.note)
  }, [route])

  let page: ReactNode
  if (route.path === '/') page = <HomePage lang={route.lang} />
  else if (route.path === '/services') page = <ServicesPage lang={route.lang} section={route.query.get('section')} />
  else if (route.path === '/works') page = <WorksPage lang={route.lang} query={route.query} />
  else if (route.path === '/prices') page = <PricesPage lang={route.lang} />
  else if (route.path === '/about') page = <AboutPage lang={route.lang} />
  else if (route.path === '/contacts') page = <ContactsPage lang={route.lang} query={route.query} />
  else if (route.path.startsWith('/works/')) {
    const project = projects.find(item => item.slug === route.path.split('/')[2])
    page = project ? <ProjectPage lang={route.lang} project={project} /> : <NotFound lang={route.lang} />
  } else if (route.path === '/projects' || route.path === '/catalog') page = <LegacyRedirect lang={route.lang} path={`/works${route.query.size ? `?${route.query.toString()}` : ''}`} />
  else if (route.path.startsWith('/projects/')) page = <LegacyRedirect lang={route.lang} path={`/works/${route.path.split('/')[2]}`} />
  else if (route.path === '/kitchens' || route.path === '/wardrobes' || route.path === '/closets') page = <LegacyRedirect lang={route.lang} path={`/services?section=${route.path.slice(1)}`} />
  else if (route.path === '/materials') page = <LegacyRedirect lang={route.lang} path="/services?section=materials" />
  else if (route.path === '/studio') page = <LegacyRedirect lang={route.lang} path="/about" />
  else page = <NotFound lang={route.lang} />

  return <div className="app"><Header route={route} />{page}<Footer lang={route.lang} /></div>
}

export default App

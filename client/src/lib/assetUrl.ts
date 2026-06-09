function withCacheBust(url: string, cacheBust: boolean) {
  if (!cacheBust) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${Date.now()}`
}

export function resolveAssetUrl(url?: string | null, options: { cacheBust?: boolean } = {}) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) {
    return withCacheBust(url, Boolean(options.cacheBust))
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || (
    import.meta.env.DEV ? 'http://localhost:4000' : (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  )

  if (url.startsWith('/')) {
    if (/^https?:\/\//i.test(apiBase)) {
      const base = new URL(apiBase)
      const basePath = base.pathname.replace(/\/$/, '')
      const path = basePath && !url.startsWith(`${basePath}/`) ? `${basePath}${url}` : url
      return withCacheBust(`${base.origin}${path}`, Boolean(options.cacheBust))
    }

    const basePath = apiBase.startsWith('/') ? apiBase.replace(/\/$/, '') : ''
    const resolved = basePath && !url.startsWith(`${basePath}/`) ? `${basePath}${url}` : url
    return withCacheBust(resolved, Boolean(options.cacheBust))
  }

  const base = apiBase.replace(/\/$/, '')
  return withCacheBust(`${base}/${url}`, Boolean(options.cacheBust))
}

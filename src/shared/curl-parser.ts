export interface ParsedCurl {
  method: string
  url: string
  headers: Array<{ key: string; value: string }>
  body?: string
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|`([^`]*)`|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(input))) {
    const raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ''
    tokens.push(raw.replace(/\\([\\"'`])/g, '$1'))
  }
  return tokens
}

function normalizeWindowsCommand(input: string): string {
  let normalized = input
    // CMD line continuation and caret escaping.
    .replace(/\^\r?\n/g, ' ')
    // Some clipboard/Markdown integrations wrap URLs as [text](url).
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$2')
    // Preserve literal query-string characters that may have been escaped for Markdown.
    .replace(/\\([_*$&])/g, '$1')
  // Collapse nested caret escapes (for example ^^\" in copied CMD text).
  for (let i = 0; i < 3; i += 1) normalized = normalized.replace(/\^(["&|<>^])/g, '$1')
  normalized = normalized.replace(/\^([{}])/g, '$1')
  return normalized
}

/** Parse the commonly copied browser/devtools curl representation. */
export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenize(normalizeWindowsCommand(input))
  if (tokens[0]?.toLowerCase() === 'curl') tokens.shift()
  let method = ''
  let url = ''
  const headers: Array<{ key: string; value: string }> = []
  const bodyParts: string[] = []
  const bodyFlags = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'])

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token === '-X' || token === '--request') {
      method = (tokens[++i] ?? '').toUpperCase()
    } else if (token.startsWith('--request=')) {
      method = token.slice('--request='.length).toUpperCase()
    } else if (token === '-H' || token === '--header') {
      const value = tokens[++i] ?? ''
      const split = value.indexOf(':')
      if (split > 0) headers.push({ key: value.slice(0, split).trim(), value: value.slice(split + 1).trim() })
    } else if (token.startsWith('--header=')) {
      const value = token.slice('--header='.length)
      const split = value.indexOf(':')
      if (split > 0) headers.push({ key: value.slice(0, split).trim(), value: value.slice(split + 1).trim() })
    } else if (token === '-b' || token === '--cookie') {
      const value = tokens[++i] ?? ''
      if (value) headers.push({ key: 'Cookie', value })
    } else if (token.startsWith('--cookie=')) {
      const value = token.slice('--cookie='.length)
      if (value) headers.push({ key: 'Cookie', value })
    } else if (bodyFlags.has(token)) {
      const value = tokens[++i]
      if (value != null) bodyParts.push(value.startsWith("@") ? '' : value)
      if (!method) method = 'POST'
    } else if ([...bodyFlags].some(flag => token.startsWith(`${flag}=`))) {
      const value = token.slice(token.indexOf('=') + 1)
      if (value) bodyParts.push(value.startsWith('@') ? '' : value)
      if (!method) method = 'POST'
    } else if (token === '--get' || token === '-G') {
      method = 'GET'
    } else if (token === '--url') {
      url = tokens[++i] ?? ''
    } else if (token.startsWith('--url=')) {
      url = token.slice('--url='.length)
    } else if (!token.startsWith('-') && !url && /^https?:\/\//i.test(token)) {
      url = token
    }
  }
  if (!url) throw new Error('未找到有效的 URL')
  if (!method) method = 'GET'
  return { method, url, headers, body: bodyParts.length ? bodyParts.join('&') : undefined }
}

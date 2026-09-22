/**
 * Logo da equipe.
 *
 * A imagem vira um data URL e mora dentro do `theme` do formulário — sem
 * bucket, sem upload separado, e o link do cliente já nasce com ela. Antes
 * disso a gente reduz para no máximo 900px e converte para WebP, senão um
 * PNG de 2 MB entraria inteiro no banco.
 */

const KEY = 'dossie:brandLogo'
const KEY_BG = 'dossie:brandLogoBg'
const MAX_SIDE = 900
const MAX_BYTES = 480_000

/** A logo e a cor de fundo que ela traz na própria imagem. */
export interface Logo {
  url: string
  /** cor chapada do fundo da imagem, ou null se for transparente/variada */
  bg: string | null
}

export function getDefaultLogo(): Logo | null {
  try {
    const url = localStorage.getItem(KEY)
    if (!url) return null
    return { url, bg: localStorage.getItem(KEY_BG) }
  } catch {
    return null
  }
}

export function setDefaultLogo(logo: Logo | null) {
  try {
    if (logo) {
      localStorage.setItem(KEY, logo.url)
      if (logo.bg) localStorage.setItem(KEY_BG, logo.bg)
      else localStorage.removeItem(KEY_BG)
    } else {
      localStorage.removeItem(KEY)
      localStorage.removeItem(KEY_BG)
    }
  } catch {
    /* quota — ignora */
  }
}

function hex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')
}

/**
 * Descobre a cor de fundo que a própria imagem traz.
 *
 * Lê oito pontos da borda (quatro cantos e o meio de cada lado). Se todos
 * forem opacos e praticamente da mesma cor, é fundo chapado — devolve a cor,
 * e a interface encosta a logo num campo dessa cor em vez de um quadrado
 * branco. Logo recortada (fundo transparente) ou imagem com borda variada
 * devolvem null, e aí não se inventa fundo nenhum.
 */
export async function detectLogoBg(dataUrl: string): Promise<string | null> {
  try {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const w = Math.max(2, Math.min(64, img.naturalWidth || 64))
    const h = Math.max(2, Math.min(64, img.naturalHeight || 64))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)

    const x1 = w - 1
    const y1 = h - 1
    const mx = Math.floor(w / 2)
    const my = Math.floor(h / 2)
    const pontos: [number, number][] = [
      [0, 0], [x1, 0], [0, y1], [x1, y1],
      [mx, 0], [mx, y1], [0, my], [x1, my],
    ]

    const cores = pontos.map(([x, y]) => ctx.getImageData(x, y, 1, 1).data)

    // fundo recortado: não há cor para pegar
    if (cores.some((c) => c[3] < 240)) return null

    const media = [0, 1, 2].map((i) => cores.reduce((t, c) => t + c[i], 0) / cores.length)
    // borda com desenho ou degradê: melhor não chutar
    const longe = cores.some((c) => [0, 1, 2].some((i) => Math.abs(c[i] - media[i]) > 18))
    if (longe) return null

    return hex(media[0], media[1], media[2])
  } catch {
    return null
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não consegui ler essa imagem.'))
    reader.readAsDataURL(file)
  })
}

export async function fileToLogo(file: File): Promise<Logo> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Precisa ser uma imagem — PNG, JPG, SVG ou WebP.')
  }

  // SVG já é leve e escala sozinho: vai inteiro.
  if (file.type === 'image/svg+xml') {
    const url = await readAsDataUrl(file)
    if (url.length > MAX_BYTES) throw new Error('Esse SVG é pesado demais. Tente um mais simples.')
    return { url, bg: await detectLogoBg(url) }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // navegador sem createImageBitmap para esse formato — manda como veio
    const url = await readAsDataUrl(file)
    if (url.length > MAX_BYTES) throw new Error('Imagem muito pesada. Use uma menor que 450 KB.')
    return { url, bg: await detectLogoBg(url) }
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não consegui processar a imagem neste navegador.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const webp = canvas.toDataURL('image/webp', 0.92)
  const out = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')

  if (out.length > MAX_BYTES) {
    const smaller = canvas.toDataURL('image/webp', 0.75)
    if (smaller.length <= MAX_BYTES) return { url: smaller, bg: await detectLogoBg(smaller) }
    throw new Error('Logo muito pesada mesmo depois de comprimir. Tente uma imagem menor.')
  }
  return { url: out, bg: await detectLogoBg(out) }
}

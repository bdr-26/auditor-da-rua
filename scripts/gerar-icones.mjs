// Ícones do ROTA (ex-Auditor da Rua) no padrão da marca (mesmo gerador do
// RH/ESTQ): nome em DCC Ash, linha, selo DA RUA FOOD INC. Este app usa
// fundo cinza escuro com tinta preta (escolha do Antonio, 22/09/2026).
// Proporções do ESTQ: letras terminam em 59% (folga até a linha em 64%),
// linha 0,6%, selo 16,6% centrado em 77%; largura máxima do texto 84%.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const PEDIDOS = 'C:/Users/anton/OneDrive/Área de Trabalho/DEV/APP - BDR PEDIDOS/bdr-pedidos'
const RH = 'C:/Users/anton/OneDrive/Área de Trabalho/DEV/APP - BDR RH'
const AUD = 'C:/Users/anton/OneDrive/Área de Trabalho/DEV/BDR - AUDITORIA LOJAS'
const req = createRequire(import.meta.url)
const C = req('@napi-rs/canvas')

C.GlobalFonts.registerFromPath(PEDIDOS + '/src/lib/DCC-Ash-pt.otf', 'DCC Ash')
const badge = await C.loadImage(readFileSync(RH + '/public/logo.png'))

const FUNDO = '#8f8f8f'   // cinza escuro aprovado
const TINTA = '#000000'
const NOME = 'ROTA'

// selo pintado de preto (mantém o desenho do logo, troca a cor)
function seloTinta(w, h) {
  const cv = C.createCanvas(w, h); const ctx = cv.getContext('2d')
  ctx.drawImage(badge, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = TINTA; ctx.fillRect(0, 0, w, h)
  return cv
}

function desenhar(S, maskable = false) {
  const cv = C.createCanvas(S, S)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = FUNDO
  ctx.fillRect(0, 0, S, S)

  const k = maskable ? 0.76 : 1
  const cx = S / 2
  const off = y => cx + (y - cx) * k

  // fonte: começa no tamanho padrão e encolhe até caber em 84% da largura
  let font = Math.round(S * 0.522 * k)
  ctx.font = `${font}px "DCC Ash"`
  const maxW = S * 0.84 * k
  if (ctx.measureText(NOME).width > maxW) {
    font = Math.floor(font * maxW / ctx.measureText(NOME).width)
    ctx.font = `${font}px "DCC Ash"`
  }
  ctx.fillStyle = TINTA
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  // ancora pelo CENTRO do texto (40,75% da altura, como no ESTQ) — para
  // nomes compridos, que encolhem para caber, a base fica mais alta e o
  // conjunto continua equilibrado (no ESTQ/RH dá o mesmo resultado)
  const asc = ctx.measureText(NOME).actualBoundingBoxAscent
  ctx.fillText(NOME, cx, off(S * 0.4075) + asc / 2)

  const esp = Math.max(3, Math.round(S * 0.006 * k))
  ctx.fillRect(cx - (S * 0.31 * k), off(S * 0.639) - esp / 2, S * 0.62 * k, esp)

  const bh = S * 0.166 * k
  const bw = bh * (badge.width / badge.height)
  ctx.drawImage(seloTinta(Math.round(bw * 2), Math.round(bh * 2)), cx - bw / 2, off(S * 0.771) - bh / 2, bw, bh)
  return cv
}

const base = desenhar(1024)
const reduzir = (S) => {
  const cv = C.createCanvas(S, S)
  const ctx = cv.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(base, 0, 0, S, S)
  return cv
}

writeFileSync(AUD + '/public/icons/icon-1024.png', base.toBuffer('image/png'))
writeFileSync(AUD + '/public/icons/icon-512.png', reduzir(512).toBuffer('image/png'))
writeFileSync(AUD + '/public/icons/icon-192.png', reduzir(192).toBuffer('image/png'))
writeFileSync(AUD + '/public/icons/apple-touch-icon.png', reduzir(180).toBuffer('image/png'))
writeFileSync(AUD + '/public/icons/icon-512-maskable.png', desenhar(512, true).toBuffer('image/png'))
console.log('ok — 5 ícones do Auditor gerados (badge-72 de notificação mantido)')

import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import sharp from 'sharp'

// GET /api/admin/captcha —— 生成图形滑块验证码（背景图 + 拼图块）
const CAPTCHA_TTL = 120 // 秒，挑战有效期
const PUZZLE_SIZE = 50
const PUZZLE_RADIUS = 10
const IMAGE_WIDTH = 350  // 保持宽度，前端会自适应
const IMAGE_HEIGHT = 100 // 降低高度到 100px

function generatePuzzlePath(size: number, radius: number): string {
  const half = size / 2
  const r = radius
  return `
    M 0 ${r}
    A ${r} ${r} 0 0 1 ${r} 0
    L ${half - r} 0
    A ${r} ${r} 0 0 1 ${half + r} 0
    L ${size - r} 0
    A ${r} ${r} 0 0 1 ${size} ${r}
    L ${size} ${half - r}
    A ${r} ${r} 0 0 0 ${size} ${half + r}
    L ${size} ${size - r}
    A ${r} ${r} 0 0 1 ${size - r} ${size}
    L ${half + r} ${size}
    A ${r} ${r} 0 0 0 ${half - r} ${size}
    L ${r} ${size}
    A ${r} ${r} 0 0 1 0 ${size - r}
    Z
  `.trim().replace(/\s+/g, ' ')
}

async function createPuzzleMask(size: number, radius: number): Promise<Buffer> {
  const svgPath = generatePuzzlePath(size, radius)
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <path d="${svgPath}" fill="white"/>
    </svg>
  `
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function generateSlideCaptcha() {
  const BG_DIR = path.join(process.cwd(), 'assets/captcha-backgrounds')
  let bgFiles: string[] = []

  try {
    if (fs.existsSync(BG_DIR)) {
      bgFiles = fs.readdirSync(BG_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    }
  } catch (err) {
    console.warn('[captcha] 背景图目录不存在或读取失败，将生成渐变色背景')
  }

  let bgImage: sharp.Sharp
  if (bgFiles.length > 0) {
    const randomBg = bgFiles[Math.floor(Math.random() * bgFiles.length)]
    bgImage = sharp(path.join(BG_DIR, randomBg)).resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover' })
  } else {
    const color = ['#4A90E2', '#50E3C2', '#F5A623', '#BD10E0', '#7ED321'][Math.floor(Math.random() * 5)]
    const svg = `
      <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.3" />
          </linearGradient>
        </defs>
        <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="url(#grad)"/>
      </svg>
    `
    bgImage = sharp(Buffer.from(svg))
  }

  const minX = 80
  const maxX = IMAGE_WIDTH - PUZZLE_SIZE - 60
  const minY = 10  // 调整上下边距，适配 100px 高度
  const maxY = IMAGE_HEIGHT - PUZZLE_SIZE - 10
  const offsetX = minX + Math.floor(Math.random() * (maxX - minX))
  const offsetY = minY + Math.floor(Math.random() * (maxY - minY))

  const puzzleMask = await createPuzzleMask(PUZZLE_SIZE, PUZZLE_RADIUS)
  const bgBuffer = await bgImage.png().toBuffer()

  const puzzlePiece = await sharp(bgBuffer)
    .extract({ left: offsetX, top: offsetY, width: PUZZLE_SIZE, height: PUZZLE_SIZE })
    .composite([{ input: puzzleMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const holeSvg = `
    <svg width="${PUZZLE_SIZE}" height="${PUZZLE_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <path d="${generatePuzzlePath(PUZZLE_SIZE, PUZZLE_RADIUS)}"
            fill="rgba(255,255,255,0.7)"
            stroke="rgba(255,255,255,0.9)"
            stroke-width="2"/>
    </svg>
  `
  const holeOverlay = Buffer.from(holeSvg)

  const backgroundWithHole = await sharp(bgBuffer)
    .composite([{ input: holeOverlay, top: offsetY, left: offsetX }])
    .png()
    .toBuffer()

  const backgroundBase64 = `data:image/png;base64,${backgroundWithHole.toString('base64')}`
  const puzzleBase64 = `data:image/png;base64,${puzzlePiece.toString('base64')}`

  return { backgroundBase64, puzzleBase64, offsetX, offsetY }
}

export default defineEventHandler(async (event) => {
  const token = crypto.randomUUID()

  const { backgroundBase64, puzzleBase64, offsetX, offsetY } = await generateSlideCaptcha()

  const redis = useRedis()
  await redis.setex(RedisKey.adminCaptcha(token), CAPTCHA_TTL, String(offsetX))

  return {
    token,
    backgroundImage: backgroundBase64,
    puzzleImage: puzzleBase64,
    puzzleWidth: 50,
    puzzleY: offsetY,  // 返回拼图块的 Y 坐标
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    trackWidth: 300,
  }
})

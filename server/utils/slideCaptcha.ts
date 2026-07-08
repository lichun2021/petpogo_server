import sharp from 'sharp'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'

// 图形滑块验证码生成工具
// 使用 sharp 从背景图中裁剪拼图块，生成缺口图 + 拼图块图

const PUZZLE_SIZE = 50 // 拼图块大小（正方形）
const PUZZLE_RADIUS = 10 // 拼图凸起半径
const IMAGE_WIDTH = 350
const IMAGE_HEIGHT = 200

// 背景图目录（存放验证码背景图，项目根目录下）
const BG_DIR = path.join(process.cwd(), 'assets/captcha-backgrounds')

/**
 * 生成拼图路径（SVG path，带凸起和凹陷）
 * 返回相对于拼图左上角的 path 字符串
 */
function generatePuzzlePath(size: number, radius: number): string {
  const half = size / 2
  const r = radius
  // 简化版：上凸、右凹、下凸、左边平
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

/**
 * 创建拼图形状的 mask（PNG alpha 通道）
 */
async function createPuzzleMask(size: number, radius: number): Promise<Buffer> {
  const svgPath = generatePuzzlePath(size, radius)
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <path d="${svgPath}" fill="white"/>
    </svg>
  `
  return sharp(Buffer.from(svg)).png().toBuffer()
}

interface CaptchaResult {
  backgroundBase64: string // 带缺口的背景图（base64）
  puzzleBase64: string     // 拼图块图片（base64）
  offsetX: number          // 拼图目标位置的 X 坐标
}

/**
 * 生成图形滑块验证码
 */
export async function generateSlideCaptcha(): Promise<CaptchaResult> {
  // 1. 随机选择一张背景图
  let bgFiles: string[] = []
  try {
    if (fs.existsSync(BG_DIR)) {
      bgFiles = fs.readdirSync(BG_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    }
  } catch (err) {
    console.warn('[captcha] 背景图目录不存在或读取失败，将生成纯色背景')
  }

  let bgImage: sharp.Sharp
  if (bgFiles.length > 0) {
    const randomBg = bgFiles[Math.floor(Math.random() * bgFiles.length)]
    bgImage = sharp(path.join(BG_DIR, randomBg)).resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover' })
  } else {
    // 无背景图时，生成渐变色占位背景
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

  // 2. 随机拼图位置（左边留 80px，右边留 60px，上下留 20px）
  const minX = 80
  const maxX = IMAGE_WIDTH - PUZZLE_SIZE - 60
  const minY = 20
  const maxY = IMAGE_HEIGHT - PUZZLE_SIZE - 20
  const offsetX = minX + Math.floor(Math.random() * (maxX - minX))
  const offsetY = minY + Math.floor(Math.random() * (maxY - minY))

  // 3. 生成拼图形状 mask
  const puzzleMask = await createPuzzleMask(PUZZLE_SIZE, PUZZLE_RADIUS)

  const bgBuffer = await bgImage.png().toBuffer()

  // 4. 提取拼图块（从背景图中裁剪出拼图形状的部分）
  const puzzlePiece = await sharp(bgBuffer)
    .extract({ left: offsetX, top: offsetY, width: PUZZLE_SIZE, height: PUZZLE_SIZE })
    .composite([{ input: puzzleMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  // 5. 在背景图上绘制缺口（用半透明白色 + 描边表示缺口）
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

  // 6. 转 base64
  const backgroundBase64 = `data:image/png;base64,${backgroundWithHole.toString('base64')}`
  const puzzleBase64 = `data:image/png;base64,${puzzlePiece.toString('base64')}`

  return { backgroundBase64, puzzleBase64, offsetX }
}

/**
 * 校验滑块位置（前端提交的 offsetX 与目标位置的误差）
 */
export function verifySlideCaptcha(userOffsetX: number, targetOffsetX: number, tolerance = 8): boolean {
  return Math.abs(userOffsetX - targetOffsetX) <= tolerance
}

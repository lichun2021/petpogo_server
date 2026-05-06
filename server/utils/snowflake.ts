// 雪花算法 ID 生成器（简化版，适合单实例）
const EPOCH = 1700000000000n
let sequence = 0n
let lastTs   = 0n

export function generateId(): bigint {
  let ts = BigInt(Date.now()) - EPOCH
  if (ts === lastTs) {
    sequence = (sequence + 1n) & 4095n
    if (sequence === 0n) {
      while (ts <= lastTs) ts = BigInt(Date.now()) - EPOCH
    }
  } else {
    sequence = 0n
  }
  lastTs = ts
  return (ts << 22n) | (1n << 12n) | sequence
}

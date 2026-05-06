// 雪花算法 ID 生成器 —— 仅用于 t_user.id
// EPOCH: 2026-01-01 00:00:00 UTC，结果为 12-13 位整数，在 JS MAX_SAFE_INTEGER 内无精度问题
const EPOCH = 1735689600000n   // 2026-01-01 毫秒时间戳
const SEQ_BITS = 10n           // 每毫秒最多 1024 个 ID
const SEQ_MASK = (1n << SEQ_BITS) - 1n

let sequence = 0n
let lastTs   = -1n

export function generateId(): bigint {
  let ts = BigInt(Date.now()) - EPOCH
  if (ts === lastTs) {
    sequence = (sequence + 1n) & SEQ_MASK
    if (sequence === 0n) {
      while (ts <= lastTs) ts = BigInt(Date.now()) - EPOCH
    }
  } else {
    sequence = 0n
  }
  lastTs = ts
  // 结果约 12-13 位，远小于 JS Number.MAX_SAFE_INTEGER (9007199254740991)
  return (ts << SEQ_BITS) | sequence
}

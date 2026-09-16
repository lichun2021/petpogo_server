// 电子宠物养成属性：饱腹度/心情值/清洁度 的衰减与加成计算
// 惰性计算：不跑定时任务，每次读取/互动时按经过时间实时算出当前值（design.md Decision 4）

export interface PetStats {
  satiety: number
  mood: number
  cleanliness: number
}

// 每小时衰减速率（可按运营需要调整）
export const DECAY_PER_HOUR = {
  satiety: 2,
  mood: 1.5,
  cleanliness: 1,
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

/**
 * 根据上次写入时间和当前时间，计算衰减后的属性值（不落库，纯计算）
 */
export function computeDecayedStats(stats: PetStats, lastUpdatedAt: string | Date | null, now: Date = new Date()): PetStats {
  if (!lastUpdatedAt) return { satiety: clamp(stats.satiety), mood: clamp(stats.mood), cleanliness: clamp(stats.cleanliness) }

  const last = typeof lastUpdatedAt === 'string' ? new Date(lastUpdatedAt.replace(' ', 'T')) : lastUpdatedAt
  const elapsedHours = Math.max(0, (now.getTime() - last.getTime()) / 3_600_000)

  return {
    satiety: clamp(stats.satiety - elapsedHours * DECAY_PER_HOUR.satiety),
    mood: clamp(stats.mood - elapsedHours * DECAY_PER_HOUR.mood),
    cleanliness: clamp(stats.cleanliness - elapsedHours * DECAY_PER_HOUR.cleanliness),
  }
}

/**
 * 在衰减后的基础上应用互动效果（增减值），结果 clamp 到 0-100
 */
export function applyInteractionEffect(
  decayed: PetStats,
  effect: { satiety_delta: number; mood_delta: number; cleanliness_delta: number }
): PetStats {
  return {
    satiety: clamp(decayed.satiety + Number(effect.satiety_delta || 0)),
    mood: clamp(decayed.mood + Number(effect.mood_delta || 0)),
    cleanliness: clamp(decayed.cleanliness + Number(effect.cleanliness_delta || 0)),
  }
}

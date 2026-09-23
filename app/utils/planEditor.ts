export interface PlanDraft {
  plan_type: number | null
  name: string
  price_monthly: number
  price_yearly: number
  duration_days: number | null
  grant_period_days: number
  period_grant_amount: number
  period_grant_type_code: string | null
  weekly_makeup_quota: number
  description: string
  status: number
}

// 数据库的数值可能以字符串返回；草稿只复制可编辑字段。
export function makePlanDraft(plan: Partial<PlanDraft> = {}): PlanDraft {
  return {
    plan_type: plan.plan_type == null ? null : Number(plan.plan_type),
    name: plan.name ?? '',
    price_monthly: Number(plan.price_monthly ?? 0),
    price_yearly: Number(plan.price_yearly ?? 0),
    duration_days: plan.duration_days == null ? null : Number(plan.duration_days),
    grant_period_days: Number(plan.grant_period_days ?? 7),
    period_grant_amount: Number(plan.period_grant_amount ?? 0),
    period_grant_type_code: plan.period_grant_type_code || null,
    weekly_makeup_quota: Number(plan.weekly_makeup_quota ?? 1),
    description: plan.description ?? '',
    status: Number(plan.status ?? 1),
  }
}

export function planPayload(draft: PlanDraft) {
  return {
    name: draft.name.trim(),
    price_monthly: Number(draft.price_monthly),
    price_yearly: Number(draft.price_yearly),
    duration_days: draft.duration_days === null || String(draft.duration_days) === '' ? null : Number(draft.duration_days),
    grant_period_days: Number(draft.grant_period_days),
    period_grant_amount: Number(draft.period_grant_amount),
    period_grant_type_code: draft.period_grant_type_code || null,
    weekly_makeup_quota: Number(draft.weekly_makeup_quota),
    description: draft.description,
    status: draft.status,
  }
}

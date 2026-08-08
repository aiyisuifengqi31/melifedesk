export type PlanFocusKind = "todo" | "reminder" | "package";

export type PlanFocus = {
  date: string;
  kind: PlanFocusKind;
  id: string;
};

let pending: PlanFocus | null = null;

/** 首页「下一件事」点击后，携带日期/类型/ID 跳转到每日计划对应项。 */
export function setPlanFocus(focus: PlanFocus) {
  pending = focus;
}

export function consumePlanFocus(): PlanFocus | null {
  const focus = pending;
  pending = null;
  return focus;
}

export type RouteKey = "home" | "plan" | "workout" | "finance" | "love" | "exam" | "fun";

export type NavItem = {
  key: RouteKey;
  label: string;
  href: `/${RouteKey}`;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "首页", href: "/home" },
  { key: "plan", label: "每日计划", href: "/plan" },
  { key: "workout", label: "运动健身", href: "/workout" },
  { key: "finance", label: "收支记账", href: "/finance" },
  { key: "love", label: "恋爱日记", href: "/love" },
  { key: "exam", label: "考公练习", href: "/exam" },
  { key: "fun", label: "娱乐", href: "/fun" }
];

export function routeToKey(route: string): RouteKey {
  const normalized = route.replace(/^\//, "").split("/")[0];
  const item = NAV_ITEMS.find((navItem) => navItem.key === normalized);
  return item?.key ?? "home";
}

export function routeToTitle(route: string): string {
  const key = routeToKey(route);
  return NAV_ITEMS.find((item) => item.key === key)?.label ?? "首页";
}

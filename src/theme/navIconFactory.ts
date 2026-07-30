import type { RouteKey } from "@/navigation/items";
import type { NavIconResource, ThemeId } from "./types";

type IconPalette = {
  accent: string;
  fill: string;
  stroke: string;
};

const palettes: Record<ThemeId, IconPalette> = {
  default: {
    accent: "#7d5fff",
    fill: "#ebe5ff",
    stroke: "#272234"
  },
  cat: {
    accent: "#e88f7a",
    fill: "#ffe6d9",
    stroke: "#34261d"
  },
  dog: {
    accent: "#d9902f",
    fill: "#ffe8bc",
    stroke: "#322414"
  }
};

const motifs: Record<RouteKey, string> = {
  plan: '<rect x="27" y="40" width="26" height="22" rx="4"/><path d="M32 36v8M48 36v8M31 50h18"/>',
  workout: '<path d="M24 52h32M24 46v12M56 46v12M31 48v8M49 48v8"/>',
  finance: '<path d="M28 43h24a5 5 0 0 1 5 5v12H23V48a5 5 0 0 1 5-5z"/><path d="M47 52h8"/>',
  love: '<path d="M28 42h24v22H28z"/><path d="M40 39c-5-6-14 1 0 10c14-9 5-16 0-10z"/>',
  gifts: '<rect x="26" y="45" width="28" height="19" rx="3"/><path d="M40 45v19M26 52h28M34 44c-6-6-10-1-4 2M46 44c6-6 10-1 4 2"/>',
  exam: '<path d="M27 39h26v25H27z"/><path d="M32 47h16M32 54h10M48 58l7 7"/>'
};

function themeHead(themeId: ThemeId, fill: string, stroke: string): string {
  if (themeId === "cat") {
    return `<path d="M22 21 L27 11 L32 21" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/><path d="M48 21 L53 11 L58 21" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>`;
  }

  if (themeId === "dog") {
    return `<path d="M20 25 Q12 18 14 34" fill="${fill}" stroke="${stroke}" stroke-width="3"/><path d="M60 25 Q68 18 66 34" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  }

  return "";
}

function createSvg(themeId: ThemeId, key: RouteKey, selected: boolean): string {
  const palette = palettes[themeId];
  const fill = selected ? palette.fill : "#ffffff";
  const stroke = selected ? palette.accent : palette.stroke;
  const head = themeHead(themeId, fill, stroke);
  const motif = motifs[key];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="18" fill="${fill}"/>
  ${head}
  <circle cx="40" cy="32" r="17" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
  <path d="M33 31h.1M47 31h.1M35 39q5 4 10 0" stroke="${stroke}" stroke-width="3" stroke-linecap="round" fill="none"/>
  <g stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">${motif}</g>
</svg>`;
}

export function createNavIconResource(themeId: ThemeId, key: RouteKey): NavIconResource {
  return {
    selected: {
      source: `${themeId}/nav-icons/${key}-selected.svg`,
      xml: createSvg(themeId, key, true)
    },
    unselected: {
      source: `${themeId}/nav-icons/${key}-unselected.svg`,
      xml: createSvg(themeId, key, false)
    }
  };
}

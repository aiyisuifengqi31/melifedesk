import type { RouteKey } from "@/navigation/items";
import type { NavIconResource, ThemeId } from "./types";

type IconPalette = {
  accent: string;
  stroke: string;
};

const palettes: Record<ThemeId, IconPalette> = {
  default: {
    accent: "#7cb87c",
    stroke: "#5c7a5c"
  },
  cat: {
    accent: "#e88f7a",
    stroke: "#475569"
  },
  dog: {
    accent: "#d9902f",
    stroke: "#475569"
  }
};

const motifs: Record<RouteKey, string> = {
  home: [
    '<path d="M28 38l12-10 12 10"/>',
    '<path d="M32 40v10h16V40"/>'
  ].join(""),
  plan: [
    '<rect x="27" y="30" width="26" height="24" rx="3"/>',
    '<path d="M27 39h26"/>',
    '<path d="M33 28v5"/>',
    '<path d="M47 28v5"/>'
  ].join(""),
  workout: [
    '<path d="M24 36h8a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-8"/>',
    '<path d="M48 36h8a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-8"/>',
    '<path d="M34 42h12"/>'
  ].join(""),
  finance: [
    '<path d="M24 30h32a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V34a4 4 0 0 1 4-4z"/>',
    '<path d="M24 38h8"/>',
    '<circle cx="48" cy="44" r="3.5"/>'
  ].join(""),
  love: [
    '<path d="M40 52c-6-7-13-2-10 5 1 2 3 5 10 9 7-4 9-7 10-9 3-7-4-12-10-5z"/>'
  ].join(""),
  exam: [
    '<path d="M25 27h30a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H25a2 2 0 0 1-2-2V29a2 2 0 0 1 2-2z"/>',
    '<path d="M27 33h26"/>',
    '<path d="M32 39h10"/>',
    '<path d="M50 42l6 6"/>',
    '<path d="M32 45h8"/>'
  ].join(""),
  fun: [
    '<path d="M34 29l16 11-16 11z"/>'
  ].join("")
};

function createSvg(themeId: ThemeId, key: RouteKey, selected: boolean): string {
  const palette = palettes[themeId];
  const circleFill = selected ? palette.accent : "#f8fafc";
  const circleStroke = selected ? palette.accent : "#e2e8f0";
  const iconStroke = selected ? "#ffffff" : palette.stroke;
  const motif = motifs[key];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <circle cx="40" cy="40" r="27" fill="${circleFill}" stroke="${circleStroke}" stroke-width="2"/>
  <g stroke="${iconStroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">${motif}</g>
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

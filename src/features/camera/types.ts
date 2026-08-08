export type CameraMode = "landscape" | "portrait";
export type CameraFacing = "user" | "environment";

export type CompositionStatus = "far" | "near" | "good";

export type CameraStatus = "idle" | "loading" | "ready" | "denied" | "unsupported" | "error";

/** Normalized box: values are 0..1 fractions of the frame. */
export type NormBox = { x: number; y: number; w: number; h: number };

export type LandscapeGuidance = {
  rule: "thirds" | "center" | "symmetry" | "horizon" | "negative";
  status: CompositionStatus;
  score: number;
  recommend: NormBox;
  mainMass: { cx: number; cy: number };
  horizonY: number | null;
  horizonTiltDeg: number;
  hint: string;
};

export type PortraitSide = "left" | "center" | "right";
export type PortraitBody = "half" | "full";

export type PersonKeypoint = { x: number; y: number; score: number; name: string };

export type PortraitGuidance = {
  side: PortraitSide;
  body: PortraitBody;
  target: NormBox;
  actual: NormBox | null;
  status: CompositionStatus;
  detected: boolean;
  hint: string;
};

export type CameraMedia = {
  video: HTMLVideoElement | null;
  canvas: HTMLCanvasElement | null;
};

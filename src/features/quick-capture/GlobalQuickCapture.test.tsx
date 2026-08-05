import { fireEvent, render } from "@testing-library/react-native";

import { getTheme } from "@/theme/registry";
import { GlobalQuickCapture } from "./GlobalQuickCapture";

// jsdom 没有网页语音识别，用一个可追踪 start/stop 的最小实现来断言点击切换行为。
class MockRecognition {
  lang = "";
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn(() => {
    captured = this;
  });
  stop = jest.fn(() => {
    captured = this;
  });
  constructor() {
    captured = this;
  }
}

let captured: MockRecognition | null = null;

const setRecognition = (value: unknown) => {
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = value;
  (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = value;
};

beforeEach(() => {
  captured = null;
  setRecognition(MockRecognition);
});

afterEach(() => {
  setRecognition(undefined);
});

const tokens = getTheme("default").tokens.light;

describe("GlobalQuickCapture voice toggle", () => {
  it("uses click to toggle: first tap starts listening, second tap stops", () => {
    const { getByLabelText } = render(<GlobalQuickCapture onClose={() => {}} tokens={tokens} />);

    // 第一次点击：开始录音（不是长按）
    fireEvent.press(getByLabelText("开始语音记录"));
    expect(captured).not.toBeNull();
    expect(captured?.start).toHaveBeenCalledTimes(1);

    // 第二次点击：结束录音
    fireEvent.press(getByLabelText("停止语音记录"));
    expect(captured?.stop).toHaveBeenCalledTimes(1);
  });

  it("shows a tap-to-start hint instead of relying on long press", () => {
    const { getByText } = render(<GlobalQuickCapture onClose={() => {}} tokens={tokens} />);
    expect(getByText("点击开始说话")).toBeOnTheScreen();
  });
});

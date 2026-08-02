import { act, render } from "@testing-library/react-native";

import { WelcomeScreen } from "@/components/WelcomeScreen";

describe("welcome screen startup", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lets users continue within one second", () => {
    const onStart = jest.fn();

    render(<WelcomeScreen onStart={onStart} />);

    act(() => {
      jest.advanceTimersByTime(900);
    });

    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

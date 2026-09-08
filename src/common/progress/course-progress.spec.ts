import { isLessonCompletedByWatch } from "./course-progress";

describe("course-progress", () => {
  it("marks lesson completed after threshold percent", () => {
    expect(isLessonCompletedByWatch(90, 100, 90)).toBe(true);
    expect(isLessonCompletedByWatch(89, 100, 90)).toBe(false);
  });
});

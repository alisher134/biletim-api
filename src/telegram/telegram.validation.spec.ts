import {
  inferReceiptExtension,
  isValidEmail,
  parseFullName,
} from "./telegram.validation";

describe("telegram.validation", () => {
  it("validates email addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("invalid-email")).toBe(false);
  });

  it("parses full names", () => {
    expect(parseFullName("Алишер Иванов")).toEqual({
      firstName: "Алишер",
      lastName: "Иванов",
    });
    expect(parseFullName("Али")).toBeNull();
  });

  it("infers receipt extensions", () => {
    expect(inferReceiptExtension("receipt.pdf", "application/pdf")).toBe(
      ".pdf",
    );
    expect(inferReceiptExtension(undefined, "image/jpeg")).toBe(".jpg");
  });
});

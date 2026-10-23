import { messageOr } from "@/lib/i18n/messages";

describe("messageOr", () => {
  it("finds a message by key and falls back for a key it does not know", () => {
    const messages = { w_book_venue: "Book the venue" };
    expect(messageOr(messages, "w_book_venue", "w_book_venue")).toBe("Book the venue");
    expect(messageOr(messages, "gone", "gone")).toBe("gone");
  });
});

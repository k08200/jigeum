import { describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({ prisma: {} }));
vi.mock("../llm-credentials.js", () => ({ getUserLlmCredentials: vi.fn() }));
vi.mock("../openai.js", () => ({ createCompletion: vi.fn(), MODEL: "test-model" }));

import { buildAttachmentCandidateProfile, type EmailAttachmentView } from "../email-attachments.js";

describe("email attachment candidate profile", () => {
  it("preserves portfolio urls when building a candidate profile", () => {
    const profile = buildAttachmentCandidateProfile([
      attachment({
        filename: "kim-profile.pdf",
        category: "profile",
        extractedFields: {
          name: "김하나",
          role: "배우",
          links: "https://example.com/showreel/actor?id=7",
          skills: "액션, 영어",
        },
      }),
    ]);

    expect(profile?.links).toEqual(["https://example.com/showreel/actor?id=7"]);
    expect(profile?.skills).toEqual(["액션", "영어"]);
  });

  it("does not treat a generic contact-only document as a candidate", () => {
    const profile = buildAttachmentCandidateProfile([
      attachment({
        filename: "invoice.pdf",
        category: "invoice",
        extractedFields: {
          contact: "billing@example.com",
          amount: "KRW 100,000",
        },
      }),
    ]);

    expect(profile).toBeNull();
  });
});

function attachment(overrides: Partial<EmailAttachmentView>): EmailAttachmentView {
  return {
    id: "att-1",
    emailId: "email-1",
    filename: "file.pdf",
    mimeType: "application/pdf",
    size: 123,
    summary: null,
    textPreview: null,
    keyPoints: [],
    extractedFields: {},
    category: null,
    analysisStatus: "ANALYZED",
    analysisError: null,
    ...overrides,
  };
}

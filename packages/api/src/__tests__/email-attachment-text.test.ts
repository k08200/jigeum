import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractAttachmentContent, isReadableEmailAttachment } from "../email-attachment-text.js";

describe("email attachment text extraction", () => {
  it("extracts plain text attachments", () => {
    const result = extractAttachmentContent(
      Buffer.from("홍길동\n이메일: actor@example.com\n키: 178cm"),
      "profile.txt",
      "text/plain",
    );

    expect(result.status).toBe("readable");
    expect(result.text).toContain("홍길동");
    expect(result.text).toContain("178cm");
  });

  it("extracts text from docx xml entries", () => {
    const docx = makeZip({
      "word/document.xml":
        "<w:document><w:body><w:p><w:r><w:t>배우 프로필</w:t></w:r></w:p><w:p><w:r><w:t>특기: 액션, 영어</w:t></w:r></w:p></w:body></w:document>",
    });

    const result = extractAttachmentContent(
      docx,
      "actor-profile.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(result.status).toBe("readable");
    expect(result.text).toContain("배우 프로필");
    expect(result.text).toContain("특기");
  });

  it("keeps image attachments as metadata for later OCR", () => {
    expect(isReadableEmailAttachment("headshot.jpg", "image/jpeg", 1024)).toBe(true);

    const result = extractAttachmentContent(Buffer.from([1, 2, 3]), "headshot.jpg", "image/jpeg");

    expect(result.status).toBe("metadata");
    expect(result.text).toContain("OCR 분석 대기");
    expect(result.text).toContain("headshot.jpg");
  });
});

function makeZip(files: Record<string, string>): Buffer {
  const chunks: Buffer[] = [];
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const compressed = deflateRawSync(Buffer.from(content));
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(Buffer.byteLength(content), 22);
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, nameBuffer, compressed);
  }
  return Buffer.concat(chunks);
}

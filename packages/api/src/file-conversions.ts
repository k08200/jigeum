import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type AttachmentConversionTarget =
  | "txt"
  | "md"
  | "json"
  | "yaml"
  | "csv"
  | "html"
  | "xml"
  | "svg"
  | "rtf"
  | "pdf"
  | "docx"
  | "xlsx"
  | "png"
  | "jpg"
  | "webp"
  | "dwg"
  | "dxf";

export interface AttachmentForConversion {
  id: string;
  filename: string;
  mimeType: string;
  size: number | null;
  contentText: string | null;
  summary: string | null;
  keyPoints: string[];
  extractedFields: Record<string, string | number | boolean | null>;
  category: string | null;
  analysisStatus: string;
  analysisError: string | null;
}

export interface ConvertedAttachment {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export class FileConversionError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "FileConversionError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const SUPPORTED_CONVERSION_TARGETS: AttachmentConversionTarget[] = [
  "txt",
  "md",
  "json",
  "yaml",
  "csv",
  "html",
  "xml",
  "svg",
  "rtf",
  "pdf",
  "docx",
  "xlsx",
  "png",
  "jpg",
  "webp",
  "dwg",
  "dxf",
];

export interface FileConversionCapability {
  target: AttachmentConversionTarget;
  label: string;
  mode: "builtin" | "external";
  available: boolean;
  description: string;
}

export interface FileConversionRecommendation {
  target: AttachmentConversionTarget;
  reason: string;
  priority: number;
}

export interface FileConversionEngineStatus {
  id: "office-layout" | "image-raster" | "cad-dwg" | "cad-dxf";
  label: string;
  category: "layout" | "image" | "cad";
  available: boolean;
  source: "env" | "auto" | "missing";
  executable: string | null;
  targets: AttachmentConversionTarget[];
  targetStatuses: Array<{ target: AttachmentConversionTarget; available: boolean }>;
  detail: string;
  setupHint: string;
}

export interface FileConversionQualityScenarioResult {
  id: string;
  label: string;
  category: "builtin" | "layout" | "image" | "cad";
  status: "pass" | "warn" | "blocked" | "fail";
  detail: string;
  durationMs: number;
  outputBytes?: number;
}

export interface FileConversionQualityReport {
  score: number;
  generatedAt: string;
  passed: number;
  warned: number;
  blocked: number;
  failed: number;
  scenarios: FileConversionQualityScenarioResult[];
}

export function getFileConversionCapabilities(): FileConversionCapability[] {
  return SUPPORTED_CONVERSION_TARGETS.map((target) => {
    if (target === "dwg" || target === "dxf") {
      const suffix = target.toUpperCase();
      const config = readExternalConverterConfig(target);
      return {
        target,
        label: suffix,
        mode: "external",
        available: !!config,
        description: `PDF 도면을 ${suffix} CAD 파일로 변환합니다.`,
      };
    }
    if (isRasterTarget(target)) {
      const config = readImageConverterConfig(target);
      return {
        target,
        label: target.toUpperCase(),
        mode: "external",
        available: !!config,
        description: `이미지 파일을 ${target.toUpperCase()} 형식으로 변환합니다.`,
      };
    }
    if (target === "pdf" || target === "docx" || target === "xlsx") {
      const hasLayoutEngine = !!readOfficeConverterConfig();
      return {
        target,
        label: target.toUpperCase(),
        mode: "builtin",
        available: true,
        description: hasLayoutEngine
          ? `${target.toUpperCase()} 변환은 원본 레이아웃 보존 엔진을 우선 사용하고, 불가하면 내장 보고서 변환으로 처리합니다.`
          : `${builtinDescription(target)} 원본 레이아웃 보존은 LibreOffice/soffice 연결 시 우선 적용됩니다.`,
      };
    }
    return {
      target,
      label: target.toUpperCase(),
      mode: "builtin",
      available: true,
      description: builtinDescription(target),
    };
  });
}

export function getFileConversionEngineStatus(): FileConversionEngineStatus[] {
  const office = readOfficeConverterConfig();
  const png = readImageConverterConfig("png");
  const jpg = readImageConverterConfig("jpg");
  const webp = readImageConverterConfig("webp");
  const dwg = readExternalConverterConfig("dwg");
  const dxf = readExternalConverterConfig("dxf");
  const dxfToDwg = readDxfToDwgConverterConfig();
  const dwgAvailable = !!dwg || (!!dxf && !!dxfToDwg);

  return [
    {
      id: "office-layout",
      label: "Layout engine",
      category: "layout",
      available: !!office,
      source: engineSource(["EVE_LIBREOFFICE_BIN", "EVE_OFFICE_CONVERTER_BIN"], !!office),
      executable: office?.bin ?? null,
      targets: ["pdf", "docx", "xlsx"],
      targetStatuses: [
        { target: "pdf", available: !!office },
        { target: "docx", available: !!office },
        { target: "xlsx", available: !!office },
      ],
      detail: office
        ? "원본 문서 레이아웃 보존 변환을 우선 시도합니다."
        : "내장 보고서 변환만 사용 중입니다.",
      setupHint: "LibreOffice/soffice를 설치하거나 EVE_LIBREOFFICE_BIN을 설정하세요.",
    },
    {
      id: "image-raster",
      label: "Image engine",
      category: "image",
      available: !!(png || jpg || webp),
      source: engineSource(
        [
          "EVE_IMAGE_CONVERTER_BIN",
          "EVE_IMAGE_TO_PNG_BIN",
          "EVE_IMAGE_TO_JPG_BIN",
          "EVE_IMAGE_TO_WEBP_BIN",
        ],
        !!(png || jpg || webp),
      ),
      executable: png?.bin ?? jpg?.bin ?? webp?.bin ?? null,
      targets: ["png", "jpg", "webp"],
      targetStatuses: [
        { target: "png", available: !!png },
        { target: "jpg", available: !!jpg },
        { target: "webp", available: !!webp },
      ],
      detail:
        png || jpg || webp
          ? "이미지 재인코딩 변환을 실행할 수 있습니다."
          : "같은 포맷 보존만 가능합니다.",
      setupHint: "ImageMagick magick을 설치하거나 EVE_IMAGE_CONVERTER_BIN을 설정하세요.",
    },
    {
      id: "cad-dwg",
      label: "PDF to DWG",
      category: "cad",
      available: dwgAvailable,
      source: engineSource(["EVE_PDF_TO_DWG_BIN", "EVE_DXF_TO_DWG_BIN"], dwgAvailable),
      executable: dwg?.bin ?? dxfToDwg?.bin ?? null,
      targets: ["dwg"],
      targetStatuses: [{ target: "dwg", available: dwgAvailable }],
      detail: dwg
        ? "DWG 전용 변환 엔진이 연결되어 있습니다."
        : dwgAvailable
          ? "PDF→DXF→DWG 후처리 파이프라인이 연결되어 있습니다."
          : "DWG 변환 엔진 또는 DXF→DWG 후처리 엔진이 아직 없습니다.",
      setupHint:
        "ODA File Converter를 설치하거나 EVE_DXF_TO_DWG_BIN 또는 EVE_PDF_TO_DWG_BIN을 설정하세요.",
    },
    {
      id: "cad-dxf",
      label: "PDF to DXF",
      category: "cad",
      available: !!dxf,
      source: engineSource(["EVE_PDF_TO_DXF_BIN"], !!dxf),
      executable: dxf?.bin ?? null,
      targets: ["dxf"],
      targetStatuses: [{ target: "dxf", available: !!dxf }],
      detail: dxf ? "DXF 변환 엔진이 연결되어 있습니다." : "DXF 변환 엔진이 아직 없습니다.",
      setupHint: "pstoedit을 설치하거나 EVE_PDF_TO_DXF_BIN을 설정하세요.",
    },
  ];
}

export async function runFileConversionQualitySuite(): Promise<FileConversionQualityReport> {
  const builtinTargets: AttachmentConversionTarget[] = [
    "txt",
    "md",
    "json",
    "yaml",
    "csv",
    "html",
    "xml",
    "svg",
    "rtf",
    "pdf",
    "docx",
    "xlsx",
  ];
  const scenarios = await Promise.all([
    ...builtinTargets.map((target) => runBuiltinQualityScenario(target)),
    runPassthroughQualityScenario("image-png-pass", "PNG 원본 보존", "png"),
    runPassthroughQualityScenario("image-jpg-pass", "JPG 원본 보존", "jpg"),
    runPassthroughQualityScenario("image-webp-pass", "WEBP 원본 보존", "webp"),
    runImageReencodeScenario("image-svg-webp", "SVG→WEBP 실제 재인코딩", "webp"),
    runLayoutEngineScenario(),
    runDxfEngineScenario(),
    runDwgPipelineScenario(),
    runEngineReadinessScenario(
      "layout-engine",
      "원본 레이아웃 보존 엔진",
      "layout",
      readOfficeConverterConfig(),
    ),
    runEngineReadinessScenario("cad-dwg-engine", "PDF→DWG 엔진", "cad", readDwgReadinessConfig()),
    runEngineReadinessScenario(
      "cad-dxf-engine",
      "PDF→DXF 엔진",
      "cad",
      readExternalConverterConfig("dxf"),
    ),
  ]);

  const passed = scenarios.filter((item) => item.status === "pass").length;
  const warned = scenarios.filter((item) => item.status === "warn").length;
  const blocked = scenarios.filter((item) => item.status === "blocked").length;
  const failed = scenarios.filter((item) => item.status === "fail").length;
  const weighted = passed + warned * 0.5;
  return {
    score: Math.round((weighted / scenarios.length) * 100),
    generatedAt: new Date().toISOString(),
    passed,
    warned,
    blocked,
    failed,
    scenarios,
  };
}

export function recommendConversionTargets(input: {
  filename: string;
  mimeType: string;
  extractionStatus?: "readable" | "metadata" | "unsupported" | string | null;
}): FileConversionRecommendation[] {
  const lower = input.filename.toLowerCase();
  const mime = input.mimeType.toLowerCase();
  const recommendations: FileConversionRecommendation[] = [];

  const push = (target: AttachmentConversionTarget, reason: string, priority: number) => {
    if (!recommendations.some((item) => item.target === target)) {
      recommendations.push({ target, reason, priority });
    }
  };

  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|svg)$/i.test(lower)) {
    const source = inferImageFormat({
      id: "",
      filename: input.filename,
      mimeType: input.mimeType,
      size: null,
      contentText: null,
      summary: null,
      keyPoints: [],
      extractedFields: {},
      category: null,
      analysisStatus: "",
      analysisError: null,
    });
    if (source === "png") push("png", "원본 이미지 포맷을 보존합니다.", 100);
    else if (source === "jpeg") push("jpg", "원본 이미지 포맷을 보존합니다.", 100);
    else if (source === "webp") push("webp", "원본 이미지 포맷을 보존합니다.", 100);
    push("pdf", "이미지를 검토용 PDF 보고서로 묶습니다.", 70);
    push("svg", "이미지 메타데이터를 요약 카드로 저장합니다.", 55);
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  if (mime.includes("spreadsheet") || /\.(xlsx|xls|csv|tsv)$/i.test(lower)) {
    push("xlsx", "표 형식을 유지하기 좋습니다.", 100);
    push("csv", "다른 시스템으로 가져가기 좋습니다.", 90);
    push("json", "구조화 데이터 연동에 적합합니다.", 70);
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  if (mime.includes("pdf") || lower.endsWith(".pdf")) {
    push("pdf", "검토용 PDF 보고서로 유지합니다.", 90);
    push("docx", "추출 내용을 편집 가능한 문서로 옮깁니다.", 80);
    if (input.extractionStatus === "readable") push("txt", "PDF 텍스트 레이어를 보존합니다.", 75);
    push("dwg", "도면 PDF라면 CAD 변환 후보입니다.", 60);
    push("dxf", "도면 교환 형식이 필요할 때 사용합니다.", 55);
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  if (mime.includes("word") || /\.(docx|doc|hwp|hwpx|rtf)$/i.test(lower)) {
    push("docx", "편집 가능한 문서로 유지합니다.", 100);
    push("pdf", "공유용 문서로 내보내기 좋습니다.", 85);
    push("md", "내용을 가볍게 정리하기 좋습니다.", 70);
    push("txt", "본문만 추출합니다.", 60);
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  if (input.extractionStatus === "readable" || /\.(txt|md|json|xml|html|yaml|yml)$/i.test(lower)) {
    push("md", "읽기 좋은 요약 문서로 변환합니다.", 95);
    push("pdf", "공유용 보고서로 저장합니다.", 85);
    push("json", "구조화 결과가 필요할 때 적합합니다.", 75);
    push("txt", "본문만 보존합니다.", 70);
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  push("pdf", "검토용 보고서로 저장합니다.", 70);
  push("json", "메타데이터와 추출 결과를 보존합니다.", 60);
  return recommendations.sort((a, b) => b.priority - a.priority);
}

async function runQualityScenario(
  id: string,
  label: string,
  category: FileConversionQualityScenarioResult["category"],
  fn: () => Promise<{ detail: string; outputBytes?: number }>,
): Promise<FileConversionQualityScenarioResult> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    return {
      id,
      label,
      category,
      status: "pass",
      detail: result.detail,
      durationMs: Date.now() - startedAt,
      outputBytes: result.outputBytes,
    };
  } catch (err) {
    return {
      id,
      label,
      category,
      status: "fail",
      detail: err instanceof Error ? err.message : "품질 테스트가 실패했습니다.",
      durationMs: Date.now() - startedAt,
    };
  }
}

function runBuiltinQualityScenario(
  target: AttachmentConversionTarget,
): Promise<FileConversionQualityScenarioResult> {
  return runQualityScenario(
    `builtin-${target}`,
    `${target.toUpperCase()} 내장 변환`,
    "builtin",
    async () => {
      const attachment = qualityAttachment(
        target === "xlsx"
          ? {
              filename: "applicants.csv",
              mimeType: "text/csv",
              contentText: "name,role\n김하나,배우\n박도윤,모델",
            }
          : { filename: "actor-profile.txt", mimeType: "text/plain" },
      );
      const converted = await convertEmailAttachment({ target, attachment });
      assertConvertedOutput(target, converted.buffer);
      return {
        detail: `${target.toUpperCase()} 샘플 변환이 정상 출력됩니다.`,
        outputBytes: converted.buffer.length,
      };
    },
  );
}

function runPassthroughQualityScenario(
  id: string,
  label: string,
  target: "png" | "jpg" | "webp",
): Promise<FileConversionQualityScenarioResult> {
  return runQualityScenario(id, label, "image", async () => {
    const source = sampleImageBuffer(target);
    const converted = await convertEmailAttachment({
      target,
      sourceBuffer: source,
      attachment: qualityAttachment({
        filename: `headshot.${target}`,
        mimeType: imageMimeType(target),
      }),
    });
    if (!converted.buffer.equals(source))
      throw new Error("원본 이미지 바이트가 보존되지 않았습니다.");
    return {
      detail: "같은 이미지 포맷은 원본 바이트를 보존합니다.",
      outputBytes: converted.buffer.length,
    };
  });
}

function runImageReencodeScenario(
  id: string,
  label: string,
  target: "png" | "jpg" | "webp",
): Promise<FileConversionQualityScenarioResult> | FileConversionQualityScenarioResult {
  if (!readImageConverterConfig(target)) {
    return blockedQualityScenario(id, label, "image", "이미지 재인코딩 엔진 연결이 필요합니다.");
  }
  return runQualityScenario(id, label, "image", async () => {
    const converted = await convertEmailAttachment({
      target,
      sourceBuffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#38bdf8"/></svg>',
        "utf-8",
      ),
      attachment: qualityAttachment({ filename: "headshot.svg", mimeType: "image/svg+xml" }),
    });
    assertConvertedOutput(target, converted.buffer);
    return {
      detail: `ImageMagick 경로로 SVG→${target.toUpperCase()} 변환이 실행됩니다.`,
      outputBytes: converted.buffer.length,
    };
  });
}

function runLayoutEngineScenario():
  | Promise<FileConversionQualityScenarioResult>
  | FileConversionQualityScenarioResult {
  if (!readOfficeConverterConfig()) {
    return blockedQualityScenario(
      "layout-rtf-pdf",
      "RTF→PDF 레이아웃 보존 변환",
      "layout",
      "LibreOffice/soffice 연결이 필요합니다.",
    );
  }
  return runQualityScenario("layout-rtf-pdf", "RTF→PDF 레이아웃 보존 변환", "layout", async () => {
    const source = Buffer.from(
      "{\\rtf1\\ansi\\deff0\\b EVE Profile\\b0\\par Name: Hana Kim\\par Role: Actor\\par}",
      "utf-8",
    );
    const converted = await convertEmailAttachment({
      target: "pdf",
      sourceBuffer: source,
      attachment: qualityAttachment({
        filename: "layout-profile.rtf",
        mimeType: "application/rtf",
      }),
    });
    assertConvertedOutput("pdf", converted.buffer);
    return {
      detail: "LibreOffice 경로로 원본 문서 레이아웃 변환이 실행됩니다.",
      outputBytes: converted.buffer.length,
    };
  });
}

function runDxfEngineScenario():
  | Promise<FileConversionQualityScenarioResult>
  | FileConversionQualityScenarioResult {
  if (!readExternalConverterConfig("dxf")) {
    return blockedQualityScenario(
      "cad-pdf-dxf",
      "PDF→DXF 실제 변환",
      "cad",
      "PDF→DXF 엔진 연결이 필요합니다.",
    );
  }
  return runQualityScenario("cad-pdf-dxf", "PDF→DXF 실제 변환", "cad", async () => {
    const pdf = await convertEmailAttachment({ target: "pdf", attachment: qualityAttachment() });
    const converted = await convertEmailAttachment({
      target: "dxf",
      sourceBuffer: pdf.buffer,
      attachment: qualityAttachment({ filename: "floor-plan.pdf", mimeType: "application/pdf" }),
    });
    if (converted.buffer.length === 0) throw new Error("DXF 결과가 비어 있습니다.");
    return {
      detail: "pstoedit 경로로 PDF→DXF 변환이 실행됩니다.",
      outputBytes: converted.buffer.length,
    };
  });
}

function runDwgPipelineScenario():
  | Promise<FileConversionQualityScenarioResult>
  | FileConversionQualityScenarioResult {
  if (!readDwgReadinessConfig()) {
    return blockedQualityScenario(
      "cad-pdf-dwg-pipeline",
      "PDF→DXF→DWG 파이프라인",
      "cad",
      "DWG 전용 엔진 또는 DXF→DWG 후처리 엔진 연결이 필요합니다.",
    );
  }
  return runQualityScenario("cad-pdf-dwg-pipeline", "PDF→DXF→DWG 파이프라인", "cad", async () => {
    const pdf = await convertEmailAttachment({ target: "pdf", attachment: qualityAttachment() });
    const converted = await convertEmailAttachment({
      target: "dwg",
      sourceBuffer: pdf.buffer,
      attachment: qualityAttachment({ filename: "floor-plan.pdf", mimeType: "application/pdf" }),
    });
    if (converted.buffer.length === 0) throw new Error("DWG 결과가 비어 있습니다.");
    return {
      detail: "PDF→DXF→DWG 파이프라인이 실제 실행됩니다.",
      outputBytes: converted.buffer.length,
    };
  });
}

function runEngineReadinessScenario(
  id: string,
  label: string,
  category: "layout" | "cad",
  config: { bin: string } | null,
): FileConversionQualityScenarioResult {
  return {
    id,
    label,
    category,
    status: config ? "pass" : "blocked",
    detail: config
      ? `${config.bin} 실행 경로가 연결되어 있습니다.`
      : "외부 변환 엔진 연결이 필요합니다.",
    durationMs: 0,
  };
}

function blockedQualityScenario(
  id: string,
  label: string,
  category: FileConversionQualityScenarioResult["category"],
  detail: string,
): FileConversionQualityScenarioResult {
  return { id, label, category, status: "blocked", detail, durationMs: 0 };
}

function assertConvertedOutput(target: AttachmentConversionTarget, buffer: Buffer): void {
  if (buffer.length === 0) throw new Error("결과 파일이 비어 있습니다.");
  if (target === "pdf" && buffer.subarray(0, 5).toString("utf-8") !== "%PDF-") {
    throw new Error("PDF 시그니처가 없습니다.");
  }
  if (
    (target === "docx" || target === "xlsx") &&
    buffer.subarray(0, 4).toString("hex") !== "504b0304"
  ) {
    throw new Error(`${target.toUpperCase()} ZIP 시그니처가 없습니다.`);
  }
  if (target === "svg" && !buffer.toString("utf-8", 0, 200).includes("<svg")) {
    throw new Error("SVG 마크업이 없습니다.");
  }
  if (target === "webp" && buffer.subarray(0, 4).toString("utf-8") !== "RIFF") {
    throw new Error("WEBP RIFF 시그니처가 없습니다.");
  }
  if (target === "png" && buffer.subarray(0, 4).toString("hex") !== "89504e47") {
    throw new Error("PNG 시그니처가 없습니다.");
  }
}

function sampleImageBuffer(target: "png" | "jpg" | "webp"): Buffer {
  if (target === "png") {
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    );
  }
  if (target === "webp") return Buffer.from("RIFF\x10\x00\x00\x00WEBPVP8 ", "binary");
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

function qualityAttachment(
  overrides: Partial<AttachmentForConversion> = {},
): AttachmentForConversion {
  return {
    id: "quality-sample",
    filename: "actor-profile.txt",
    mimeType: "text/plain",
    size: 128,
    contentText: "이름: 김하나\n역할: 배우\n연락처: 010-1234-5678\n경력: 독립영화 2편",
    summary: "배우 지원자 프로필",
    keyPoints: ["배우 지원", "연락처 포함", "경력 포함"],
    extractedFields: {
      name: "김하나",
      role: "배우",
      phone: "010-1234-5678",
    },
    category: "profile",
    analysisStatus: "ANALYZED",
    analysisError: null,
    ...overrides,
  };
}

export function createStoredZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  return zipStore(entries);
}

const TARGETS = new Set<AttachmentConversionTarget>(SUPPORTED_CONVERSION_TARGETS);

export function normalizeConversionTarget(value: unknown): AttachmentConversionTarget | null {
  if (typeof value !== "string") return null;
  const target = value.trim().toLowerCase();
  return TARGETS.has(target as AttachmentConversionTarget)
    ? (target as AttachmentConversionTarget)
    : null;
}

export function requiresOriginalAttachment(target: AttachmentConversionTarget): boolean {
  return target === "dwg" || target === "dxf" || isRasterTarget(target);
}

export async function convertEmailAttachment(input: {
  attachment: AttachmentForConversion;
  target: AttachmentConversionTarget;
  sourceBuffer?: Buffer;
}): Promise<ConvertedAttachment> {
  switch (input.target) {
    case "txt":
      return buildTextConversion(input.attachment);
    case "md":
      return buildMarkdownConversion(input.attachment);
    case "json":
      return buildJsonConversion(input.attachment);
    case "yaml":
      return buildYamlConversion(input.attachment);
    case "csv":
      return buildCsvConversion(input.attachment);
    case "html":
      return buildHtmlConversion(input.attachment);
    case "xml":
      return buildXmlConversion(input.attachment);
    case "svg":
      return buildSvgConversion(input.attachment);
    case "rtf":
      return buildRtfConversion(input.attachment);
    case "pdf":
      return (
        (await tryLayoutPreservingDocumentConversion(
          input.attachment,
          input.target,
          input.sourceBuffer,
        )) ?? buildPdfConversion(input.attachment)
      );
    case "docx":
      return (
        (await tryLayoutPreservingDocumentConversion(
          input.attachment,
          input.target,
          input.sourceBuffer,
        )) ?? buildDocxConversion(input.attachment)
      );
    case "xlsx":
      return (
        (await tryLayoutPreservingDocumentConversion(
          input.attachment,
          input.target,
          input.sourceBuffer,
        )) ?? buildXlsxConversion(input.attachment)
      );
    case "png":
    case "jpg":
    case "webp":
      return convertImageFormat(input.attachment, input.target, input.sourceBuffer);
    case "dwg":
    case "dxf":
      return convertPdfToCad(input.attachment, input.target, input.sourceBuffer);
    default:
      throw new FileConversionError("unsupported_target", "지원하지 않는 변환 형식이에요.", 400);
  }
}

function buildTextConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const text = attachment.contentText?.trim();
  if (!text) {
    throw new FileConversionError(
      "no_extracted_text",
      "이 파일에는 변환할 수 있는 추출 텍스트가 아직 없어요. 먼저 첨부 분석 또는 OCR을 실행해 주세요.",
      422,
    );
  }
  return {
    filename: withExtension(attachment.filename, "txt"),
    mimeType: "text/plain; charset=utf-8",
    buffer: Buffer.from(text, "utf-8"),
  };
}

function buildMarkdownConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const lines = [
    `# ${attachment.filename}`,
    "",
    `- MIME: ${attachment.mimeType || "unknown"}`,
    `- Size: ${attachment.size ?? "unknown"}`,
    `- Category: ${attachment.category ?? "unknown"}`,
    `- Status: ${attachment.analysisStatus}`,
    "",
  ];
  if (attachment.summary) lines.push("## Summary", "", attachment.summary, "");
  if (attachment.keyPoints.length > 0) {
    lines.push("## Key Points", "", ...attachment.keyPoints.map((point) => `- ${point}`), "");
  }
  if (Object.keys(attachment.extractedFields).length > 0) {
    lines.push("## Extracted Fields", "");
    for (const [key, value] of Object.entries(attachment.extractedFields)) {
      if (value !== null && value !== "") lines.push(`- ${key}: ${String(value)}`);
    }
    lines.push("");
  }
  if (attachment.contentText?.trim()) {
    lines.push("## Extracted Text", "", attachment.contentText.trim(), "");
  }
  if (attachment.analysisError) {
    lines.push("## Analysis Note", "", attachment.analysisError, "");
  }
  return {
    filename: withExtension(attachment.filename, "md"),
    mimeType: "text/markdown; charset=utf-8",
    buffer: Buffer.from(lines.join("\n"), "utf-8"),
  };
}

function buildJsonConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const payload = {
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    summary: attachment.summary,
    keyPoints: attachment.keyPoints,
    extractedFields: attachment.extractedFields,
    category: attachment.category,
    analysisStatus: attachment.analysisStatus,
    analysisError: attachment.analysisError,
    contentText: attachment.contentText,
  };
  return {
    filename: withExtension(attachment.filename, "json"),
    mimeType: "application/json; charset=utf-8",
    buffer: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf-8"),
  };
}

function buildYamlConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const fields = Object.entries(attachment.extractedFields)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => `  ${yamlKey(key)}: ${yamlScalar(String(value))}`)
    .join("\n");
  const yaml = [
    `id: ${yamlScalar(attachment.id)}`,
    `filename: ${yamlScalar(attachment.filename)}`,
    `mimeType: ${yamlScalar(attachment.mimeType)}`,
    `size: ${attachment.size ?? "null"}`,
    `category: ${attachment.category ? yamlScalar(attachment.category) : "null"}`,
    `analysisStatus: ${yamlScalar(attachment.analysisStatus)}`,
    `summary: ${attachment.summary ? yamlScalar(attachment.summary) : "null"}`,
    "keyPoints:",
    ...(attachment.keyPoints.length > 0
      ? attachment.keyPoints.map((point) => `  - ${yamlScalar(point)}`)
      : ["  []"]),
    "extractedFields:",
    fields || "  {}",
    `contentText: ${attachment.contentText?.trim() ? yamlBlock(attachment.contentText.trim()) : "null"}`,
  ].join("\n");
  return {
    filename: withExtension(attachment.filename, "yaml"),
    mimeType: "application/yaml; charset=utf-8",
    buffer: Buffer.from(`${yaml}\n`, "utf-8"),
  };
}

function buildCsvConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const rows: string[][] = [
    ["field", "value"],
    ["filename", attachment.filename],
    ["mimeType", attachment.mimeType],
    ["size", attachment.size === null ? "" : String(attachment.size)],
    ["category", attachment.category ?? ""],
    ["analysisStatus", attachment.analysisStatus],
    ["summary", attachment.summary ?? ""],
  ];
  attachment.keyPoints.forEach((point, index) => {
    rows.push([`keyPoint.${index + 1}`, point]);
  });
  for (const [key, value] of Object.entries(attachment.extractedFields)) {
    rows.push([`extracted.${key}`, value === null ? "" : String(value)]);
  }
  if (attachment.contentText?.trim()) rows.push(["contentText", attachment.contentText.trim()]);
  if (attachment.analysisError) rows.push(["analysisError", attachment.analysisError]);

  return {
    filename: withExtension(attachment.filename, "csv"),
    mimeType: "text/csv; charset=utf-8",
    buffer: Buffer.from(
      `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`,
      "utf-8",
    ),
  };
}

function buildHtmlConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const fieldRows = Object.entries(attachment.extractedFields)
    .filter(([, value]) => value !== null && value !== "")
    .map(
      ([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`,
    )
    .join("\n");
  const keyPoints = attachment.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("\n");
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(attachment.filename)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #1c1917; line-height: 1.55; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .meta { color: #78716c; font-size: 13px; margin-bottom: 24px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #e7e5e4; padding: 8px; text-align: left; vertical-align: top; }
    th { width: 180px; background: #f5f5f4; }
    pre { white-space: pre-wrap; background: #f5f5f4; padding: 16px; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(attachment.filename)}</h1>
  <p class="meta">${escapeHtml(attachment.mimeType)} · ${attachment.size ?? "unknown"} bytes · ${escapeHtml(attachment.analysisStatus)}</p>
  ${attachment.summary ? `<h2>Summary</h2><p>${escapeHtml(attachment.summary)}</p>` : ""}
  ${keyPoints ? `<h2>Key Points</h2><ul>${keyPoints}</ul>` : ""}
  ${fieldRows ? `<h2>Extracted Fields</h2><table>${fieldRows}</table>` : ""}
  ${attachment.contentText?.trim() ? `<h2>Extracted Text</h2><pre>${escapeHtml(attachment.contentText.trim())}</pre>` : ""}
</body>
</html>
`;
  return {
    filename: withExtension(attachment.filename, "html"),
    mimeType: "text/html; charset=utf-8",
    buffer: Buffer.from(html, "utf-8"),
  };
}

function buildXmlConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const fields = Object.entries(attachment.extractedFields)
    .filter(([, value]) => value !== null && value !== "")
    .map(
      ([key, value]) => `    <field name="${escapeXml(key)}">${escapeXml(String(value))}</field>`,
    )
    .join("\n");
  const points = attachment.keyPoints
    .map((point) => `    <point>${escapeXml(point)}</point>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<attachment>
  <filename>${escapeXml(attachment.filename)}</filename>
  <mimeType>${escapeXml(attachment.mimeType)}</mimeType>
  <size>${attachment.size ?? ""}</size>
  <category>${escapeXml(attachment.category ?? "")}</category>
  <analysisStatus>${escapeXml(attachment.analysisStatus)}</analysisStatus>
  <summary>${escapeXml(attachment.summary ?? "")}</summary>
  <keyPoints>
${points}
  </keyPoints>
  <extractedFields>
${fields}
  </extractedFields>
  <contentText>${escapeXml(attachment.contentText ?? "")}</contentText>
</attachment>
`;
  return {
    filename: withExtension(attachment.filename, "xml"),
    mimeType: "application/xml; charset=utf-8",
    buffer: Buffer.from(xml, "utf-8"),
  };
}

function buildSvgConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const report = buildPlainReport(attachment);
  const lines = report.split(/\r?\n/).slice(0, 36);
  const width = 900;
  const height = Math.max(420, 88 + lines.length * 22);
  const text = lines
    .map(
      (line, index) =>
        `<text x="36" y="${74 + index * 22}" font-size="${index === 0 ? 22 : 14}" font-weight="${index === 0 ? 700 : 400}">${escapeXml(line.slice(0, 110))}</text>`,
    )
    .join("\n  ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="36" y="44" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12" fill="#64748b">EVE converted report</text>
  <g font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0f172a">
  ${text}
  </g>
</svg>
`;
  return {
    filename: withExtension(attachment.filename, "svg"),
    mimeType: "image/svg+xml; charset=utf-8",
    buffer: Buffer.from(svg, "utf-8"),
  };
}

function buildRtfConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const text = buildPlainReport(attachment);
  const body = text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .split(/\r?\n/)
    .map((line) => `${line}\\par`)
    .join("\n");
  return {
    filename: withExtension(attachment.filename, "rtf"),
    mimeType: "application/rtf",
    buffer: Buffer.from(`{\\rtf1\\ansi\\deff0\n${body}\n}`, "utf-8"),
  };
}

function buildPdfConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  return {
    filename: withExtension(attachment.filename, "pdf"),
    mimeType: "application/pdf",
    buffer: createSimplePdf(buildPlainReport(attachment)),
  };
}

function buildDocxConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  return {
    filename: withExtension(attachment.filename, "docx"),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: createDocx(buildPlainReport(attachment)),
  };
}

function buildXlsxConversion(attachment: AttachmentForConversion): ConvertedAttachment {
  const rows: string[][] = [
    ["Field", "Value"],
    ["Filename", attachment.filename],
    ["MIME", attachment.mimeType],
    ["Size", attachment.size === null ? "" : String(attachment.size)],
    ["Category", attachment.category ?? ""],
    ["Status", attachment.analysisStatus],
    ["Summary", attachment.summary ?? ""],
  ];
  attachment.keyPoints.forEach((point, index) => {
    rows.push([`Key Point ${index + 1}`, point]);
  });
  for (const [key, value] of Object.entries(attachment.extractedFields)) {
    rows.push([key, value === null ? "" : String(value)]);
  }
  if (attachment.contentText?.trim()) rows.push(["Extracted Text", attachment.contentText.trim()]);
  return {
    filename: withExtension(attachment.filename, "xlsx"),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: createXlsx(rows),
  };
}

async function tryLayoutPreservingDocumentConversion(
  attachment: AttachmentForConversion,
  target: "pdf" | "docx" | "xlsx",
  sourceBuffer?: Buffer,
): Promise<ConvertedAttachment | null> {
  if (!sourceBuffer || sourceBuffer.length === 0) return null;

  const sourceExt = normalizedSourceExtension(attachment);
  if (sourceExt === target) {
    return {
      filename: withExtension(attachment.filename, target),
      mimeType: documentMimeType(target),
      buffer: sourceBuffer,
    };
  }

  const config = readOfficeConverterConfig();
  if (!config || !canConvertWithOfficeEngine(sourceExt, target)) return null;

  const tempDir = await mkdtemp(path.join(tmpdir(), "eve-layout-convert-"));
  try {
    const inputPath = documentSourceTempPath(tempDir, sourceExt);
    await writeFile(inputPath, sourceBuffer);
    await runExternalConverter(config.bin, [
      "--headless",
      "--convert-to",
      target,
      "--outdir",
      tempDir,
      inputPath,
    ]);
    const outputPath = await findConvertedOutput(tempDir, target);
    if (!outputPath) {
      throw new FileConversionError(
        "converter_failed",
        "레이아웃 보존 변환기는 실행됐지만 결과 파일을 만들지 못했어요.",
        500,
      );
    }
    return {
      filename: withExtension(attachment.filename, target),
      mimeType: documentMimeType(target),
      buffer: await readFile(outputPath),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function convertImageFormat(
  attachment: AttachmentForConversion,
  target: "png" | "jpg" | "webp",
  sourceBuffer?: Buffer,
): Promise<ConvertedAttachment> {
  if (!isImageAttachment(attachment)) {
    throw new FileConversionError(
      "unsupported_source",
      "이미지 변환은 이미지 원본만 지원해요.",
      415,
    );
  }
  if (!sourceBuffer || sourceBuffer.length === 0) {
    throw new FileConversionError(
      "missing_source",
      "이미지 변환을 위해 원본 파일이 필요해요.",
      422,
    );
  }

  const sourceFormat = inferImageFormat(attachment);
  if (sourceFormat === target || (sourceFormat === "jpeg" && target === "jpg")) {
    return {
      filename: withExtension(attachment.filename, target),
      mimeType: imageMimeType(target),
      buffer: sourceBuffer,
    };
  }

  const config = readImageConverterConfig(target);
  if (!config) {
    throw new FileConversionError(
      "converter_unavailable",
      [
        `${sourceFormat?.toUpperCase() ?? "IMAGE"}→${target.toUpperCase()} 이미지 변환 엔진이 아직 서버에 연결되지 않았어요.`,
        `ImageMagick 같은 변환기를 설치한 뒤 EVE_IMAGE_CONVERTER_BIN 또는 EVE_IMAGE_TO_${target.toUpperCase()}_BIN 환경변수를 설정하면 실제 재인코딩됩니다.`,
      ].join(" "),
      501,
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "eve-image-convert-"));
  try {
    const inputPath = imageSourceTempPath(tempDir, sourceFormat);
    const outputPath = imageOutputTempPath(tempDir, target);
    await writeFile(inputPath, sourceBuffer);
    const args = config.args.map((arg) =>
      arg.replaceAll("{input}", inputPath).replaceAll("{output}", outputPath),
    );
    await runExternalConverter(config.bin, args);
    const buffer = await readFile(outputPath);
    return {
      filename: withExtension(attachment.filename, target),
      mimeType: imageMimeType(target),
      buffer,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function convertPdfToCad(
  attachment: AttachmentForConversion,
  target: "dwg" | "dxf",
  sourceBuffer?: Buffer,
): Promise<ConvertedAttachment> {
  if (!isPdfAttachment(attachment)) {
    throw new FileConversionError(
      "unsupported_source",
      "현재 CAD 변환은 PDF 원본만 지원해요.",
      415,
    );
  }
  if (!sourceBuffer || sourceBuffer.length === 0) {
    throw new FileConversionError(
      "missing_source",
      "CAD 변환을 위해 원본 PDF 파일이 필요해요.",
      422,
    );
  }

  const config = readExternalConverterConfig(target);
  const dxfToDwgConfig = target === "dwg" ? readDxfToDwgConverterConfig() : null;
  const dxfConfig = target === "dwg" ? readExternalConverterConfig("dxf") : null;
  if (!config && !(target === "dwg" && dxfConfig && dxfToDwgConfig)) {
    throw new FileConversionError(
      "converter_unavailable",
      [
        `PDF→${target.toUpperCase()} 변환 엔진이 아직 서버에 연결되지 않았어요.`,
        target === "dwg"
          ? "EVE_PDF_TO_DWG_BIN을 설정하거나 ODA File Converter를 설치한 뒤 EVE_DXF_TO_DWG_BIN을 설정하면 PDF→DXF→DWG 파이프라인으로 생성합니다."
          : "EVE_PDF_TO_DXF_BIN 환경변수를 설정하면 이 버튼이 실제 DXF 파일을 생성합니다.",
      ].join(" "),
      501,
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "eve-file-convert-"));
  try {
    const inputPath = tempPathWithin(tempDir, "source.pdf");
    const outputPath = cadOutputTempPath(tempDir, target);
    await writeFile(inputPath, sourceBuffer);
    if (config) {
      const args = config.args.map((arg) =>
        arg.replaceAll("{input}", inputPath).replaceAll("{output}", outputPath),
      );
      await runExternalConverter(config.bin, args);
    } else if (dxfConfig && dxfToDwgConfig) {
      const dxfPath = tempPathWithin(tempDir, "intermediate.dxf");
      const dxfArgs = dxfConfig.args.map((arg) =>
        arg.replaceAll("{input}", inputPath).replaceAll("{output}", dxfPath),
      );
      await runExternalConverter(dxfConfig.bin, dxfArgs);
      await runDxfToDwgConverter(dxfToDwgConfig, dxfPath, outputPath, tempDir);
    }
    const buffer = await readFile(outputPath);
    return {
      filename: withExtension(attachment.filename, target),
      mimeType: target === "dwg" ? "image/vnd.dwg" : "image/vnd.dxf",
      buffer,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function readExternalConverterConfig(
  target: "dwg" | "dxf",
): { bin: string; args: string[] } | null {
  const suffix = target.toUpperCase();
  const envConfig = readTemplateConverterConfig(
    `EVE_PDF_TO_${suffix}_BIN`,
    `EVE_PDF_TO_${suffix}_ARGS`,
    ["{input}", "{output}"],
  );
  if (envConfig) return envConfig;
  if (converterAutodetectDisabled()) return null;
  if (target === "dxf") {
    const pstoedit = findExecutable(["pstoedit"]);
    if (pstoedit) return { bin: pstoedit, args: ["-f", "dxf", "{input}", "{output}"] };
  }
  return null;
}

type DxfToDwgConverterConfig =
  | { mode: "template"; bin: string; args: string[] }
  | { mode: "oda"; bin: string };

function readDwgReadinessConfig(): { bin: string } | null {
  const direct = readExternalConverterConfig("dwg");
  if (direct) return { bin: direct.bin };
  const dxf = readExternalConverterConfig("dxf");
  const dxfToDwg = readDxfToDwgConverterConfig();
  return dxf && dxfToDwg ? { bin: dxfToDwg.bin } : null;
}

function readDxfToDwgConverterConfig(): DxfToDwgConverterConfig | null {
  const envConfig = readTemplateConverterConfig("EVE_DXF_TO_DWG_BIN", "EVE_DXF_TO_DWG_ARGS", [
    "{input}",
    "{output}",
  ]);
  if (envConfig) return { mode: "template", ...envConfig };
  if (converterAutodetectDisabled()) return null;
  const oda = findExecutable([
    "ODAFileConverter",
    "/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter",
    "/Applications/ODA File Converter.app/Contents/MacOS/ODAFileConverter",
  ]);
  return oda ? { mode: "oda", bin: oda } : null;
}

async function runDxfToDwgConverter(
  config: DxfToDwgConverterConfig,
  inputPath: string,
  outputPath: string,
  tempDir: string,
): Promise<void> {
  if (config.mode === "template") {
    const args = config.args.map((arg) =>
      arg.replaceAll("{input}", inputPath).replaceAll("{output}", outputPath),
    );
    await runExternalConverter(config.bin, args);
    return;
  }

  const inputDir = tempPathWithin(tempDir, "oda-input");
  const outputDir = tempPathWithin(tempDir, "oda-output");
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await copyFile(inputPath, tempPathWithin(inputDir, "converted.dxf"));
  await runExternalConverter(config.bin, [inputDir, outputDir, "ACAD2018", "DWG", "0", "1"]);
  const dwgPath = await findConvertedOutput(outputDir, "dwg");
  if (!dwgPath) {
    throw new FileConversionError(
      "converter_failed",
      "DXF→DWG 후처리 엔진은 실행됐지만 DWG 결과 파일을 만들지 못했어요.",
      500,
    );
  }
  await copyFile(dwgPath, outputPath);
}

function readImageConverterConfig(target: "png" | "jpg" | "webp"): {
  bin: string;
  args: string[];
} | null {
  const suffix = target.toUpperCase();
  return (
    readTemplateConverterConfig(`EVE_IMAGE_TO_${suffix}_BIN`, `EVE_IMAGE_TO_${suffix}_ARGS`, [
      "{input}",
      "{output}",
    ]) ??
    readTemplateConverterConfig("EVE_IMAGE_CONVERTER_BIN", "EVE_IMAGE_CONVERTER_ARGS", [
      "{input}",
      "{output}",
    ]) ??
    (converterAutodetectDisabled()
      ? null
      : (() => {
          const magick = findExecutable([
            "magick",
            "/opt/homebrew/bin/magick",
            "/usr/local/bin/magick",
          ]);
          return magick ? { bin: magick, args: ["{input}", "{output}"] } : null;
        })())
  );
}

function readOfficeConverterConfig(): { bin: string } | null {
  const envBin =
    process.env.EVE_LIBREOFFICE_BIN?.trim() || process.env.EVE_OFFICE_CONVERTER_BIN?.trim();
  if (envBin) return { bin: envBin };
  if (converterAutodetectDisabled()) return null;
  const bin = findExecutable([
    "soffice",
    "libreoffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/opt/homebrew/bin/soffice",
    "/usr/local/bin/soffice",
  ]);
  return bin ? { bin } : null;
}

function readTemplateConverterConfig(
  binEnv: string,
  argsEnv: string,
  defaultArgs: string[],
): { bin: string; args: string[] } | null {
  const bin = process.env[binEnv]?.trim();
  if (!bin) return null;
  const rawArgs = process.env[argsEnv]?.trim();
  if (!rawArgs) return { bin, args: defaultArgs };
  try {
    const parsed = JSON.parse(rawArgs);
    if (!Array.isArray(parsed) || !parsed.every((arg) => typeof arg === "string")) {
      throw new Error("args must be a JSON string array");
    }
    return { bin, args: parsed };
  } catch (err) {
    throw new FileConversionError(
      "converter_misconfigured",
      err instanceof Error ? err.message : "변환기 인자 설정이 잘못됐어요.",
      500,
    );
  }
}

function engineSource(envNames: string[], available: boolean): "env" | "auto" | "missing" {
  if (envNames.some((name) => !!process.env[name]?.trim())) return "env";
  return available ? "auto" : "missing";
}

function runExternalConverter(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, windowsHide: true });
    let stderr = "";
    const timeoutMs = converterTimeoutMs();
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new FileConversionError(
          "converter_timeout",
          `변환기가 ${Math.round(timeoutMs / 1000)}초 안에 완료되지 않았어요.`,
          504,
        ),
      );
    }, timeoutMs);
    child.stdout?.resume();
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new FileConversionError("converter_failed", err.message, 500));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new FileConversionError(
          "converter_failed",
          (stderr || `변환기가 종료 코드 ${code}로 실패했어요.`).slice(0, 700),
          500,
        ),
      );
    });
  });
}

async function findConvertedOutput(tempDir: string, target: string): Promise<string | null> {
  const files = await readdir(tempDir);
  const match = files.find((file) => file.toLowerCase().endsWith(`.${target}`));
  return match ? path.join(tempDir, match) : null;
}

function canConvertWithOfficeEngine(sourceExt: string, target: "pdf" | "docx" | "xlsx"): boolean {
  if (target === "pdf") {
    return /^(doc|docx|odt|rtf|txt|md|html|htm|xls|xlsx|ods|csv|tsv|ppt|pptx|odp)$/i.test(
      sourceExt,
    );
  }
  if (target === "docx") {
    return /^(doc|odt|rtf|txt|md|html|htm)$/i.test(sourceExt);
  }
  return /^(xls|ods|csv|tsv)$/i.test(sourceExt);
}

function documentMimeType(target: "pdf" | "docx" | "xlsx"): string {
  if (target === "pdf") return "application/pdf";
  if (target === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function normalizedSourceExtension(attachment: AttachmentForConversion): string {
  const ext = sourceExtension(attachment).toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (ext === "htm") return "html";
  return ext;
}

function findExecutable(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate.includes("/") && existsSync(candidate)) return candidate;
  }
  const paths = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) continue;
    for (const dir of paths) {
      const fullPath = path.join(dir, candidate);
      if (existsSync(fullPath)) return fullPath;
    }
  }
  return null;
}

function converterTimeoutMs(): number {
  const value = Number(process.env.EVE_CONVERTER_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1000 ? value : 60_000;
}

function converterAutodetectDisabled(): boolean {
  return process.env.EVE_DISABLE_CONVERTER_AUTODETECT === "1";
}

function isPdfAttachment(attachment: AttachmentForConversion): boolean {
  return (
    attachment.mimeType.toLowerCase().includes("pdf") ||
    attachment.filename.toLowerCase().endsWith(".pdf")
  );
}

function isRasterTarget(target: AttachmentConversionTarget): target is "png" | "jpg" | "webp" {
  return target === "png" || target === "jpg" || target === "webp";
}

function isImageAttachment(attachment: AttachmentForConversion): boolean {
  const lower = attachment.filename.toLowerCase();
  return (
    attachment.mimeType.toLowerCase().startsWith("image/") ||
    /\.(png|jpg|jpeg|webp|gif|heic|svg)$/i.test(lower)
  );
}

function inferImageFormat(attachment: AttachmentForConversion): string | null {
  const mime = attachment.mimeType.toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpeg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("heic")) return "heic";
  const ext = sourceExtension(attachment);
  if (ext === "jpg") return "jpeg";
  return ext;
}

function sourceExtension(attachment: AttachmentForConversion): string {
  const lower = attachment.filename.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  return ext || "bin";
}

function documentSourceTempPath(baseDir: string, extension: string): string {
  switch (extension) {
    case "csv":
      return tempPathWithin(baseDir, "source.csv");
    case "doc":
      return tempPathWithin(baseDir, "source.doc");
    case "docx":
      return tempPathWithin(baseDir, "source.docx");
    case "html":
      return tempPathWithin(baseDir, "source.html");
    case "md":
      return tempPathWithin(baseDir, "source.md");
    case "ods":
      return tempPathWithin(baseDir, "source.ods");
    case "odt":
      return tempPathWithin(baseDir, "source.odt");
    case "pdf":
      return tempPathWithin(baseDir, "source.pdf");
    case "rtf":
      return tempPathWithin(baseDir, "source.rtf");
    case "tsv":
      return tempPathWithin(baseDir, "source.tsv");
    case "txt":
      return tempPathWithin(baseDir, "source.txt");
    case "xls":
      return tempPathWithin(baseDir, "source.xls");
    case "xlsx":
      return tempPathWithin(baseDir, "source.xlsx");
    default:
      return tempPathWithin(baseDir, "source.bin");
  }
}

function imageSourceTempPath(baseDir: string, format: string | null): string {
  switch (format) {
    case "gif":
      return tempPathWithin(baseDir, "source.gif");
    case "heic":
      return tempPathWithin(baseDir, "source.heic");
    case "jpeg":
      return tempPathWithin(baseDir, "source.jpg");
    case "png":
      return tempPathWithin(baseDir, "source.png");
    case "svg":
      return tempPathWithin(baseDir, "source.svg");
    case "webp":
      return tempPathWithin(baseDir, "source.webp");
    default:
      return tempPathWithin(baseDir, "source.bin");
  }
}

function imageOutputTempPath(baseDir: string, target: "png" | "jpg" | "webp"): string {
  switch (target) {
    case "jpg":
      return tempPathWithin(baseDir, "converted.jpg");
    case "png":
      return tempPathWithin(baseDir, "converted.png");
    case "webp":
      return tempPathWithin(baseDir, "converted.webp");
  }
}

function cadOutputTempPath(baseDir: string, target: "dwg" | "dxf"): string {
  return target === "dwg"
    ? tempPathWithin(baseDir, "converted.dwg")
    : tempPathWithin(baseDir, "converted.dxf");
}

function tempPathWithin(baseDir: string, child: string): string {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, child);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error("Unsafe conversion temp path");
  }
  return resolved;
}

function imageMimeType(target: "png" | "jpg" | "webp"): string {
  if (target === "jpg") return "image/jpeg";
  return `image/${target}`;
}

function withExtension(filename: string, extension: string): string {
  const base = path.basename(filename || "attachment").replace(/[\\/:*?"<>|]+/g, "_");
  const withoutExt = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
  return `${withoutExt || "attachment"}.${extension}`;
}

function builtinDescription(target: AttachmentConversionTarget): string {
  switch (target) {
    case "txt":
      return "추출 텍스트만 저장합니다.";
    case "md":
      return "요약, 필드, 본문을 Markdown 보고서로 저장합니다.";
    case "json":
      return "분석 결과와 추출 텍스트를 JSON으로 저장합니다.";
    case "yaml":
      return "분석 결과와 추출 텍스트를 YAML로 저장합니다.";
    case "csv":
      return "파일 메타데이터와 추출 필드를 CSV 표로 저장합니다.";
    case "html":
      return "브라우저에서 볼 수 있는 HTML 보고서로 저장합니다.";
    case "xml":
      return "연동용 XML 문서로 저장합니다.";
    case "svg":
      return "요약 보고서를 SVG 이미지로 저장합니다.";
    case "rtf":
      return "리치 텍스트 문서로 저장합니다.";
    case "pdf":
      return "추출 내용을 간단한 PDF 보고서로 저장합니다.";
    case "docx":
      return "추출 내용을 Word 문서로 저장합니다.";
    case "xlsx":
      return "추출 필드와 요약을 Excel 문서로 저장합니다.";
    case "png":
      return "이미지를 PNG 형식으로 변환합니다.";
    case "jpg":
      return "이미지를 JPG 형식으로 변환합니다.";
    case "webp":
      return "이미지를 WEBP 형식으로 변환합니다.";
    default:
      return "외부 변환 엔진이 필요한 포맷입니다.";
  }
}

function buildPlainReport(attachment: AttachmentForConversion): string {
  const lines = [
    attachment.filename,
    "",
    `MIME: ${attachment.mimeType || "unknown"}`,
    `Size: ${attachment.size ?? "unknown"}`,
    `Category: ${attachment.category ?? "unknown"}`,
    `Status: ${attachment.analysisStatus}`,
  ];
  if (attachment.summary) lines.push("", "Summary", attachment.summary);
  if (attachment.keyPoints.length > 0) {
    lines.push("", "Key Points", ...attachment.keyPoints.map((point) => `- ${point}`));
  }
  const fields = Object.entries(attachment.extractedFields).filter(
    ([, value]) => value !== null && value !== "",
  );
  if (fields.length > 0) {
    lines.push("", "Extracted Fields", ...fields.map(([key, value]) => `${key}: ${String(value)}`));
  }
  if (attachment.contentText?.trim()) {
    lines.push("", "Extracted Text", attachment.contentText.trim());
  }
  if (attachment.analysisError) lines.push("", "Analysis Note", attachment.analysisError);
  return `${lines.join("\n").trim()}\n`;
}

function csvCell(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  return `"${normalized.replace(/"/g, '""')}"`;
}

function yamlKey(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value) ? value : JSON.stringify(value);
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function yamlBlock(value: string): string {
  return `|\n${value
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: string): string {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function createSimplePdf(text: string): Buffer {
  const pages = splitLinesForPdf(text);
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageRefs = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`);
  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 750 Td",
      "14 TL",
      ...pageLines.map((line, lineIndex) => {
        const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
        return `${lineIndex === 0 ? "" : "T* "}(${escaped}) Tj`;
      }),
      "ET",
    ].join("\n");
    objects.push(
      `<< /Length ${Buffer.byteLength(content, "utf-8")} >>\nstream\n${content}\nendstream`,
    );
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const chunks = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let offset = Buffer.byteLength(chunks[0], "utf-8");
  objects.forEach((object, index) => {
    offsets.push(offset);
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    offset += Buffer.byteLength(chunk, "utf-8");
  });
  const xrefOffset = offset;
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (let index = 1; index < offsets.length; index++) {
    chunks.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  return Buffer.from(chunks.join(""), "utf-8");
}

function splitLinesForPdf(text: string): string[][] {
  const lines = text.split(/\r?\n/).flatMap((line) => wrapLineForPdf(sanitizePdfLine(line)));
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 48) {
    pages.push(lines.slice(index, index + 48));
  }
  return pages.length > 0 ? pages : [[""]];
}

function sanitizePdfLine(line: string): string {
  let sanitized = "";
  for (const char of line) {
    const code = char.codePointAt(0) ?? 0;
    const isPrintableAscii = code >= 0x20 && code <= 0x7e;
    const isKorean =
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x3131 && code <= 0x318e) ||
      (code >= 0x1100 && code <= 0x11ff);
    sanitized += isPrintableAscii || isKorean ? char : "?";
  }
  return sanitized;
}

function wrapLineForPdf(line: string): string[] {
  if (line.length <= 92) return [line];
  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += 92) {
    chunks.push(line.slice(index, index + 92));
  }
  return chunks;
}

function createDocx(text: string): Buffer {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${text
  .split(/\r?\n/)
  .map((line) => `    <w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
  .join("\n")}
  </w:body>
</w:document>`;
  return zipStore([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
        "utf-8",
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
        "utf-8",
      ),
    },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf-8") },
  ]);
}

function createXlsx(rows: string[][]): Buffer {
  const sheetData = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map(
            (cell, cellIndex) =>
              `<c r="${columnName(cellIndex + 1)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("");
  return zipStore([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
        "utf-8",
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
        "utf-8",
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
        "utf-8",
      ),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Converted" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
        "utf-8",
      ),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetData}</sheetData>
</worksheet>`,
        "utf-8",
      ),
    },
  ]);
}

function columnName(index: number): string {
  let value = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

function zipStore(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const now = dosDateTime(new Date());

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf-8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(now.time, 10);
    localHeader.writeUInt16LE(now.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.time, 12);
    centralHeader.writeUInt16LE(now.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + entry.data.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

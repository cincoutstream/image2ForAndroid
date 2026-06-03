import type {
  DebugLogPayload,
  GenerationRequest,
  ImageInput,
  ImageResult,
} from "../types";
import type { ProviderConfig } from "../types";
import { defaultProviderConfig } from "../types";

type OpenAiImageResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
  message?: string;
  success?: boolean;
};

export type BuiltImageRequest = {
  url: string;
  init: RequestInit;
  debug: {
    requestMode: "chat_messages" | "images_generations";
    endpoint: string;
    model: string;
    imageCount: number;
    imageOrder: string[];
  };
};

export function resolveGenerationEndpoint(
  provider: ProviderConfig,
  inputImages: ImageInput[],
): string {
  return inputImages.length > 0
    ? provider.referenceEndpoint || defaultProviderConfig.referenceEndpoint
    : provider.endpoint || defaultProviderConfig.endpoint;
}

export type GenerationDebugListener = (payload: DebugLogPayload) => void;

export function joinUrl(baseUrl: string, endpoint: string): string {
  const cleanBase = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const cleanEndpoint = String(endpoint ?? "").trim().replace(/^\/+/, "");
  return cleanEndpoint ? `${cleanBase}/${cleanEndpoint}` : cleanBase;
}

export function buildImageGenerationRequest(
  request: GenerationRequest,
): BuiltImageRequest {
  const hasReferenceImages = request.inputImages.length > 0;
  const endpoint = resolveGenerationEndpoint(
    request.provider,
    request.inputImages,
  );
  const url = joinUrl(request.provider.baseUrl, endpoint);
  const imageOrder = request.inputImages
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((image) => `图 ${image.index}: ${image.displayName ?? image.localUri}`);
  const debug = {
    requestMode: hasReferenceImages ? "chat_messages" : "images_generations",
    endpoint,
    model: request.provider.model,
    imageCount: request.inputImages.length,
    imageOrder,
  } satisfies BuiltImageRequest["debug"];

  if (hasReferenceImages) {
    assertImagesHaveBase64(request.inputImages);
    return {
      url,
      init: {
        method: "POST",
        headers: buildJsonHeaders(request.apiKey),
        body: JSON.stringify(buildChatCompletionBody(request)),
      },
      debug,
    };
  }

  return {
    url,
    init: {
      method: "POST",
      headers: buildJsonHeaders(request.apiKey),
      body: JSON.stringify(buildImagesGenerationsBody(request)),
    },
    debug,
  };
}

function buildJsonHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey.trim()}`,
  };
}

function buildImagesGenerationsBody(request: GenerationRequest) {
  return {
    model: request.provider.model.trim(),
    prompt: request.prompt.trim(),
    size: request.provider.size.trim() || "1024x1024",
    n: 1,
    response_format: request.provider.responseFormat,
  };
}

function buildChatCompletionBody(request: GenerationRequest) {
  const content = [
    { type: "text", text: request.prompt.trim() },
    ...request.inputImages
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((image) => ({
        type: "image_url",
        image_url: {
          url: buildDataImageUrl(image),
        },
      })),
  ];

  return {
    model: request.provider.model.trim(),
    ...(() => {
      const group = String(request.provider.group ?? "").trim();
      return group ? { group } : {};
    })(),
    prompt: request.prompt.trim(),
    messages: [
      {
        role: "user",
        content,
      },
    ],
    stream: request.provider.stream,
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };
}

function assertImagesHaveBase64(inputImages: ImageInput[]): void {
  const missingBase64Image = inputImages.find((image) => !image.base64Data);
  if (missingBase64Image) {
    throw new Error(
      `图 ${missingBase64Image.index} 没有读取到图片内容，已阻止发送。`,
    );
  }
}

function buildDataImageUrl(image: ImageInput): string {
  return `data:${image.mimeType};base64,${image.base64Data}`;
}

export function extractImageResults(response: OpenAiImageResponse): ImageResult[] {
  const data = Array.isArray(response.data) ? response.data : [];
  const results: ImageResult[] = [];

  for (const item of data) {
    if (item.url) {
      results.push({ type: "url", value: item.url });
      continue;
    }

    if (item.b64_json) {
      results.push({ type: "base64", value: item.b64_json });
    }
  }

  for (const choice of response.choices ?? []) {
    const content = choice.message?.content ?? choice.delta?.content ?? "";
    for (const url of extractMarkdownImageUrls(content)) {
      results.push({ type: "url", value: url });
    }
  }

  return results;
}

function extractMarkdownImageUrls(content: string): string[] {
  return Array.from(content.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)).map(
    (match) => match[1],
  );
}

export async function generateImages(
  request: GenerationRequest,
  signal?: AbortSignal,
  onDebug?: GenerationDebugListener,
): Promise<ImageResult[]> {
  const builtRequest = buildImageGenerationRequest(request);
  onDebug?.({
    summary: "即将发送请求",
    details: buildRequestDebugDetails(request, builtRequest),
  });
  const response = await fetch(builtRequest.url, {
    ...builtRequest.init,
    signal,
  });
  const text = await response.text();
  onDebug?.({
    summary: `收到响应：HTTP ${response.status}`,
    details: {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      responseTextPreview: text.slice(0, 2000),
      responseTextLength: text.length,
    },
  });
  const body = parseResponseText(text, response.headers.get("content-type"));
  const apiError = extractApiErrorMessage(body);

  if (!response.ok) {
    throw new Error(apiError ?? `请求失败：HTTP ${response.status}`);
  }

  if (apiError) {
    throw new Error(apiError);
  }

  const results = extractImageResults(body);
  if (results.length === 0) {
    throw new Error("响应中没有找到 data[].url 或 data[].b64_json 图片结果。");
  }

  return results;
}

export function extractApiErrorMessage(
  body: OpenAiImageResponse | null | undefined,
): string | undefined {
  if (!body) return undefined;

  if (typeof body.error?.message === "string" && body.error.message.trim()) {
    return body.error.message;
  }

  if (body.success === false && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  return undefined;
}

function parseResponseText(text: string, contentType: string | null): OpenAiImageResponse {
  if (!text) return {};

  if (contentType?.includes("text/event-stream") || text.includes("\ndata:")) {
    let content = "";
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.replace(/^data:\s*/, "");
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload) as OpenAiImageResponse;
        content += chunk.choices?.[0]?.delta?.content ?? "";
        content += chunk.choices?.[0]?.message?.content ?? "";
      } catch {
        content += payload;
      }
    }

    return {
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    };
  }

  return JSON.parse(text) as OpenAiImageResponse;
}

function buildRequestDebugDetails(
  request: GenerationRequest,
  builtRequest: BuiltImageRequest,
) {
  return {
    url: builtRequest.url,
    method: builtRequest.init.method,
    requestMode: builtRequest.debug.requestMode,
    endpoint: builtRequest.debug.endpoint,
    configuredEndpoint: request.provider.endpoint,
    configuredReferenceEndpoint: request.provider.referenceEndpoint,
    model: request.provider.model,
    size: request.provider.size,
    responseFormat: request.provider.responseFormat,
    imageInputMode: request.provider.imageInputMode,
    group: request.provider.group,
    stream: request.provider.stream,
    prompt: request.prompt,
    containsReferenceImages: request.inputImages.length > 0,
    imageCount: request.inputImages.length,
    inputImages: request.inputImages.map((image) => ({
      index: image.index,
      displayName: image.displayName,
      mimeType: image.mimeType,
      localUri: image.localUri,
      hasBase64Data: Boolean(image.base64Data),
      base64Length: image.base64Data?.length ?? 0,
      base64Preview: image.base64Data
        ? `${image.base64Data.slice(0, 24)}...`
        : undefined,
    })),
    jsonBody:
      typeof builtRequest.init.body === "string"
        ? safeJsonParse(builtRequest.init.body)
        : undefined,
  };
}

function safeJsonParse(value: string): unknown {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (Array.isArray(parsed.messages)) {
      parsed.messages = parsed.messages.map((message) => {
        const messageRecord = message as Record<string, unknown>;
        if (!Array.isArray(messageRecord.content)) return messageRecord;

        return {
          ...messageRecord,
          content: messageRecord.content.map((part) => {
            const partRecord = part as Record<string, unknown>;
            if (partRecord.type !== "image_url") return partRecord;
            const imageUrl = partRecord.image_url as Record<string, unknown>;
            const url = String(imageUrl.url ?? "");
            return {
              ...partRecord,
              image_url: {
                ...imageUrl,
                url: url ? `${url.slice(0, 64)}...` : undefined,
                url_length: url.length,
              },
            };
          }),
        };
      });
    }
    return parsed;
  } catch {
    return value;
  }
}

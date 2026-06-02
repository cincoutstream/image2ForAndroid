import type {
  DebugLogPayload,
  GenerationRequest,
  ImageInput,
  ImageResult,
} from "../types";

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
};

export type BuiltImageRequest = {
  url: string;
  init: RequestInit;
  debug: {
    requestMode: "json" | "chat_messages" | "json_base64" | "multipart";
    endpoint: string;
    model: string;
    imageCount: number;
    imageOrder: string[];
  };
};

export type MultipartImagePart = {
  fieldName: "image";
  index: number;
  uri: string;
  name: string;
  type: ImageInput["mimeType"];
};

export type GenerationDebugListener = (payload: DebugLogPayload) => void;

export function joinUrl(baseUrl: string, endpoint: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  const cleanEndpoint = endpoint.trim().replace(/^\/+/, "");
  return cleanEndpoint ? `${cleanBase}/${cleanEndpoint}` : cleanBase;
}

export function buildImageGenerationRequest(
  request: GenerationRequest,
): BuiltImageRequest {
  const url = joinUrl(request.provider.baseUrl, request.provider.endpoint);
  const debug = {
    requestMode:
      request.provider.imageInputMode === "chat_messages"
        ? "chat_messages"
        : request.inputImages.length > 0
          ? request.provider.imageInputMode
          : "json",
    endpoint: request.provider.endpoint,
    model: request.provider.model,
    imageCount: request.inputImages.length,
    imageOrder: buildOrderedImageParts(request.inputImages).map(
      (part) => `图 ${part.index}: ${part.name}`,
    ),
  } satisfies BuiltImageRequest["debug"];

  if (
    request.provider.imageInputMode === "chat_messages"
  ) {
    if (request.inputImages.length > 0) {
      assertImagesHaveBase64(request.inputImages);
    }
    const content =
      request.inputImages.length > 0
        ? [
            { type: "text", text: request.prompt.trim() },
            ...request.inputImages
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((image) => ({
                type: "image_url",
                image_url: {
                  url: `data:${image.mimeType};base64,${image.base64Data}`,
                },
              })),
          ]
        : request.prompt.trim();
    const body = {
      model: request.provider.model.trim(),
      ...(request.provider.group.trim()
        ? { group: request.provider.group.trim() }
        : {}),
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

    return {
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${request.apiKey.trim()}`,
        },
        body: JSON.stringify(body),
      },
      debug,
    };
  }

  if (
    request.inputImages.length > 0 &&
    request.provider.imageInputMode === "multipart"
  ) {
    const formData = new FormData();
    formData.append("model", request.provider.model.trim());
    formData.append("prompt", request.prompt.trim());
    formData.append("size", request.provider.size.trim());
    formData.append("n", "1");
    formData.append("response_format", request.provider.responseFormat);
    formData.append(
      "image_order",
      JSON.stringify(buildOrderedImageParts(request.inputImages)),
    );

    for (const image of buildOrderedImageParts(request.inputImages)) {
      appendImagePart(formData, image);
    }

    return {
      url,
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${request.apiKey.trim()}`,
        },
        body: formData,
      },
      debug,
    };
  }

  const body: Record<string, unknown> = {
    model: request.provider.model.trim(),
    prompt: request.prompt.trim(),
    size: request.provider.size.trim(),
    n: 1,
    response_format: request.provider.responseFormat,
  };

  if (request.inputImages.length > 0) {
    assertImagesHaveBase64(request.inputImages);
    body.input_images = request.inputImages
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((image) => ({
        index: image.index,
        b64_json: image.base64Data,
        mime_type: image.mimeType,
        display_name: image.displayName,
      }));
  }

  return {
    url,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    },
    debug,
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

export function buildOrderedImageParts(
  inputImages: ImageInput[],
): MultipartImagePart[] {
  return inputImages
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((image) => ({
      fieldName: "image",
      index: image.index,
      uri: image.localUri,
      name: image.displayName || `image-${image.index}.${mimeTypeToExtension(image.mimeType)}`,
      type: image.mimeType,
    }));
}

function mimeTypeToExtension(mimeType: ImageInput["mimeType"]): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function appendImagePart(formData: FormData, image: MultipartImagePart): void {
  const isReactNative =
    typeof navigator !== "undefined" && navigator.product === "ReactNative";

  if (isReactNative) {
    formData.append(image.fieldName, {
      uri: image.uri,
      name: image.name,
      type: image.type,
    } as unknown as Blob);
    return;
  }

  formData.append(image.fieldName, new Blob([], { type: image.type }), image.name);
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

  if (!response.ok) {
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `请求失败：HTTP ${response.status}`;
    throw new Error(message);
  }

  const results = extractImageResults(body);
  if (results.length === 0) {
    throw new Error("响应中没有找到 data[].url 或 data[].b64_json 图片结果。");
  }

  return results;
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
        : "multipart/form-data",
  };
}

function safeJsonParse(value: string): unknown {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (Array.isArray(parsed.input_images)) {
      parsed.input_images = parsed.input_images.map((image) => {
        const imageRecord = image as Record<string, unknown>;
        const b64 = String(imageRecord.b64_json ?? "");
        return {
          ...imageRecord,
          b64_json: b64 ? `${b64.slice(0, 24)}...` : undefined,
          b64_json_length: b64.length,
        };
      });
    }
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

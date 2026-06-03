import { describe, expect, it } from "vitest";

import {
  buildImageGenerationRequest,
  extractApiErrorMessage,
  extractImageResults,
  joinUrl,
  resolveGenerationEndpoint,
} from "./openAiImageProvider";

const baseProvider = {
  baseUrl: "https://www.micuapi.ai/v1",
  endpoint: "/images/generations",
  referenceEndpoint: "/chat/completions",
  model: "gpt-image-2-pro",
  size: "1024x1024",
  responseFormat: "url" as const,
  imageInputMode: "chat_messages" as const,
  group: "vip_2_image",
  stream: true,
};

describe("OpenAI-compatible image provider", () => {
  it("joins baseUrl and endpoint without changing the configured path", () => {
    expect(joinUrl("https://www.micuapi.ai/v1/", "/images/generations")).toBe(
      "https://www.micuapi.ai/v1/images/generations",
    );
    expect(joinUrl("https://www.micuapi.ai/v1", "/chat/completions")).toBe(
      "https://www.micuapi.ai/v1/chat/completions",
    );
    expect(joinUrl("https://www.micuapi.ai/v1", "/pg/chat/completions")).toBe(
      "https://www.micuapi.ai/v1/pg/chat/completions",
    );
  });

  it("falls back when referenceEndpoint is missing on legacy config", () => {
    const legacyProvider = {
      ...baseProvider,
      referenceEndpoint: undefined as unknown as string,
    };

    expect(
      buildImageGenerationRequest({
        provider: legacyProvider,
        apiKey: "sk-test",
        prompt: "改色",
        inputImages: [
          {
            index: 1,
            localUri: "file:///a.png",
            mimeType: "image/png",
            base64Data: "ZmFrZQ==",
          },
        ],
      }).url,
    ).toBe("https://www.micuapi.ai/v1/chat/completions");
  });

  it("resolves endpoint from provider config", () => {
    expect(resolveGenerationEndpoint(baseProvider, [])).toBe("/images/generations");
    expect(
      resolveGenerationEndpoint(baseProvider, [
        {
          index: 1,
          localUri: "file:///role.png",
          mimeType: "image/png",
        },
      ]),
    ).toBe("/chat/completions");
  });

  it("builds a text-to-image request using configured endpoint", () => {
    const request = buildImageGenerationRequest({
      provider: baseProvider,
      apiKey: "sk-test",
      prompt: "一只穿宇航服的橘猫",
      inputImages: [],
    });

    expect(request.url).toBe("https://www.micuapi.ai/v1/images/generations");
    expect(request.debug.requestMode).toBe("images_generations");
    expect(JSON.parse(String(request.init.body))).toMatchObject({
      model: "gpt-image-2-pro",
      prompt: "一只穿宇航服的橘猫",
      size: "1024x1024",
      n: 1,
      response_format: "url",
    });
  });

  it("builds chat request using configured reference endpoint", () => {
    const request = buildImageGenerationRequest({
      provider: baseProvider,
      apiKey: "sk-test",
      prompt: "衣服改成紫色",
      inputImages: [
        {
          index: 1,
          localUri: "file:///role.png",
          mimeType: "image/png",
          displayName: "role.png",
          base64Data: "ZmFrZS1pbWFnZQ==",
        },
      ],
    });

    expect(request.url).toBe("https://www.micuapi.ai/v1/chat/completions");
    expect(request.debug.requestMode).toBe("chat_messages");
    expect(JSON.parse(String(request.init.body))).toMatchObject({
      model: "gpt-image-2-pro",
      group: "vip_2_image",
      stream: true,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "衣服改成紫色" },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
              },
            },
          ],
        },
      ],
    });
  });

  it("supports custom /pg/chat/completions when configured", () => {
    const request = buildImageGenerationRequest({
      provider: {
        ...baseProvider,
        baseUrl: "https://gateway.example.com",
        referenceEndpoint: "/pg/chat/completions",
      },
      apiKey: "sk-test",
      prompt: "改色",
      inputImages: [
        {
          index: 1,
          localUri: "file:///a.png",
          mimeType: "image/png",
          base64Data: "ZmFrZQ==",
        },
      ],
    });

    expect(request.url).toBe("https://gateway.example.com/pg/chat/completions");
  });

  it("rejects chat image requests when image content is missing", () => {
    expect(() =>
      buildImageGenerationRequest({
        provider: baseProvider,
        apiKey: "sk-test",
        prompt: "参考第一张图生成",
        inputImages: [
          {
            index: 1,
            localUri: "file:///role.png",
            mimeType: "image/png",
            displayName: "role.png",
          },
        ],
      }),
    ).toThrow("没有读取到图片内容");
  });

  it("extracts gateway error messages", () => {
    expect(
      extractApiErrorMessage({
        success: false,
        message: "Unauthorized, invalid access token",
      }),
    ).toBe("Unauthorized, invalid access token");
  });

  it("extracts url and base64 image results", () => {
    expect(
      extractImageResults({
        data: [
          { url: "https://example.com/a.png" },
          { b64_json: "YmFzZTY0" },
        ],
      }),
    ).toEqual([
      { type: "url", value: "https://example.com/a.png" },
      { type: "base64", value: "YmFzZTY0" },
    ]);
  });

  it("extracts markdown image url from chat completion response", () => {
    expect(
      extractImageResults({
        choices: [
          {
            message: {
              content:
                "> ✅ 绘图已完成\n\n![image](https://oss.filenest.top/uploads/result.png)\n\n",
            },
          },
        ],
      }),
    ).toEqual([
      { type: "url", value: "https://oss.filenest.top/uploads/result.png" },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildImageGenerationRequest,
  buildOrderedImageParts,
  extractImageResults,
  joinUrl,
} from "./openAiImageProvider";

describe("OpenAI-compatible image provider", () => {
  it("joins base url and endpoint without duplicate slashes", () => {
    expect(joinUrl("https://www.micuapi.ai/v1/", "/images/generations")).toBe(
      "https://www.micuapi.ai/v1/images/generations",
    );
  });

  it("builds a text-to-image request body", () => {
    const request = buildImageGenerationRequest({
      provider: {
        baseUrl: "https://www.micuapi.ai/v1",
        endpoint: "/images/generations",
        model: "image2",
        size: "1024x1024",
        responseFormat: "url",
        imageInputMode: "json_base64",
        group: "vip_2_image",
        stream: false,
      },
      apiKey: "sk-test",
      prompt: "一只穿宇航服的橘猫",
      inputImages: [],
    });

    expect(request.url).toBe("https://www.micuapi.ai/v1/images/generations");
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer sk-test",
    });
    expect(JSON.parse(String(request.init.body))).toEqual({
      model: "image2",
      prompt: "一只穿宇航服的橘猫",
      size: "1024x1024",
      n: 1,
      response_format: "url",
    });
  });

  it("builds chat messages request with data image url references", () => {
    const request = buildImageGenerationRequest({
      provider: {
        baseUrl: "https://www.micuapi.ai/v1",
        endpoint: "/chat/completions",
        model: "gpt-image-2-pro",
        size: "1024x1024",
        responseFormat: "url",
        imageInputMode: "chat_messages",
        group: "vip_2_image",
        stream: true,
      },
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

  it("builds multipart request when reference images are selected", () => {
    const request = buildImageGenerationRequest({
      provider: {
        baseUrl: "https://www.micuapi.ai/v1",
        endpoint: "/images/generations",
        model: "image2",
        size: "1024x1024",
        responseFormat: "b64_json",
        imageInputMode: "multipart",
        group: "vip_2_image",
        stream: false,
      },
      apiKey: "sk-test",
      prompt: "第一张图作为角色，第二张图作为背景",
      inputImages: [
        {
          index: 1,
          localUri: "file:///role.png",
          mimeType: "image/png",
          displayName: "role.png",
        },
      ],
    });

    expect(request.init.headers).toMatchObject({
      Authorization: "Bearer sk-test",
    });
    expect(request.init.headers).not.toHaveProperty("Content-Type");
    expect(request.debug.requestMode).toBe("multipart");
    expect(request.debug.imageCount).toBe(1);
  });

  it("builds json base64 request when selected by provider config", () => {
    const request = buildImageGenerationRequest({
      provider: {
        baseUrl: "https://www.micuapi.ai/v1",
        endpoint: "/images/generations",
        model: "gpt-image-2",
        size: "1024x1024",
        responseFormat: "url",
        imageInputMode: "json_base64",
        group: "vip_2_image",
        stream: false,
      },
      apiKey: "sk-test",
      prompt: "参考第一张图生成",
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

    expect(request.debug.requestMode).toBe("json_base64");
    expect(request.init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer sk-test",
    });
    expect(JSON.parse(String(request.init.body))).toMatchObject({
      input_images: [
        {
          index: 1,
          b64_json: "ZmFrZS1pbWFnZQ==",
          mime_type: "image/png",
          display_name: "role.png",
        },
      ],
    });
  });

  it("rejects json base64 image requests when image content is missing", () => {
    expect(() =>
      buildImageGenerationRequest({
        provider: {
          baseUrl: "https://www.micuapi.ai/v1",
          endpoint: "/images/generations",
          model: "gpt-image-2",
          size: "1024x1024",
          responseFormat: "url",
          imageInputMode: "json_base64",
          group: "vip_2_image",
          stream: false,
        },
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

  it("keeps multipart image order by input index", () => {
    expect(
      buildOrderedImageParts([
        {
          index: 2,
          localUri: "file:///background.webp",
          mimeType: "image/webp",
          displayName: "background.webp",
        },
        {
          index: 1,
          localUri: "file:///role.png",
          mimeType: "image/png",
          displayName: "role.png",
        },
      ]),
    ).toEqual([
        {
          fieldName: "image",
          index: 1,
          uri: "file:///role.png",
          name: "role.png",
          type: "image/png",
        },
        {
          fieldName: "image",
          index: 2,
          uri: "file:///background.webp",
          name: "background.webp",
          type: "image/webp",
        },
      ]);
  });

  it("adds image order metadata for model-side debugging", () => {
    const request = buildImageGenerationRequest({
      provider: {
        baseUrl: "https://www.micuapi.ai/v1",
        endpoint: "/images/generations",
        model: "image2",
        size: "1024x1024",
        responseFormat: "b64_json",
        imageInputMode: "multipart",
        group: "vip_2_image",
        stream: false,
      },
      apiKey: "sk-test",
      prompt: "第一张图作为角色，第二张图作为背景",
      inputImages: [
        {
          index: 2,
          localUri: "file:///background.webp",
          mimeType: "image/webp",
          displayName: "background.webp",
        },
      ],
    });

    expect(request.debug.imageOrder).toEqual(["图 2: background.webp"]);
  });

  it("extracts url and base64 image results", () => {
    const response = {
      data: [
        { url: "https://example.com/a.png" },
        { b64_json: "YmFzZTY0" },
        { ignored: true },
      ],
    };

    expect(
      extractImageResults(response as Parameters<typeof extractImageResults>[0]),
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

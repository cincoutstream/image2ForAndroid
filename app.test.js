const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildImageGenerationRequest,
  joinUrl,
  extractImageResults,
} = require("./app.js");

test("joinUrl combines baseUrl and endpoint without duplicate slashes", () => {
  assert.equal(
    joinUrl("https://www.micuapi.ai/v1/", "/images/generations"),
    "https://www.micuapi.ai/v1/images/generations",
  );
});

test("buildImageGenerationRequest creates an OpenAI-compatible image request", () => {
  const request = buildImageGenerationRequest({
    baseUrl: "https://www.micuapi.ai/v1",
    endpoint: "/images/generations",
    apiKey: "sk-test",
    model: "image2",
    prompt: "a tiny robot painter",
    size: "1024x1024",
    responseFormat: "url",
  });

  assert.equal(request.url, "https://www.micuapi.ai/v1/images/generations");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer sk-test");
  assert.deepEqual(JSON.parse(request.options.body), {
    model: "image2",
    prompt: "a tiny robot painter",
    size: "1024x1024",
    n: 1,
    response_format: "url",
  });
});

test("extractImageResults supports url and base64 OpenAI-style responses", () => {
  const results = extractImageResults({
    data: [
      { url: "https://example.com/image.png" },
      { b64_json: "ZmFrZS1pbWFnZQ==" },
    ],
  });

  assert.deepEqual(results, [
    { type: "url", value: "https://example.com/image.png" },
    { type: "base64", value: "ZmFrZS1pbWFnZQ==" },
  ]);
});

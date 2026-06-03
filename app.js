(function (root) {
  function joinUrl(baseUrl, endpoint) {
    const cleanBase = String(baseUrl || "").trim().replace(/\/+$/, "");
    const cleanEndpoint = String(endpoint || "").trim().replace(/^\/+/, "");
    return cleanEndpoint ? `${cleanBase}/${cleanEndpoint}` : cleanBase;
  }

  function buildImageGenerationRequest({
    baseUrl,
    endpoint,
    apiKey,
    model,
    prompt,
    size,
    responseFormat,
  }) {
    const body = {
      model: String(model || "").trim(),
      prompt: String(prompt || "").trim(),
      size: String(size || "").trim() || "1024x1024",
      n: 1,
      response_format: String(responseFormat || "url").trim(),
    };

    return {
      url: joinUrl(baseUrl, endpoint || "/images/generations"),
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${String(apiKey || "").trim()}`,
        },
        body: JSON.stringify(body),
      },
    };
  }

  async function buildImageExperimentRequest({
    baseUrl,
    endpoint,
    referenceEndpoint,
    apiKey,
    model,
    prompt,
    size,
    responseFormat,
    experimentMode,
    imageFiles,
  }) {
    const files = Array.from(imageFiles || []);
    const resolvedEndpoint =
      files.length > 0
        ? referenceEndpoint || "/chat/completions"
        : endpoint || "/images/generations";
    const url = joinUrl(baseUrl, resolvedEndpoint);
    const mode = files.length > 0 ? "chat_messages" : "images_generations";

    if (mode === "chat_messages") {
      const imageParts = await Promise.all(
        files.map(async (file) => ({
          type: "image_url",
          image_url: {
            url: `data:${file.type};base64,${await fileToBase64(file)}`,
          },
        })),
      );
      const body = {
        model: String(model || "").trim(),
        group: "vip_2_image",
        messages: [
          {
            role: "user",
            content:
              imageParts.length > 0
                ? [
                    { type: "text", text: String(prompt || "").trim() },
                    ...imageParts,
                  ]
                : String(prompt || "").trim(),
          },
        ],
        stream: true,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      };

      return {
        url,
        options: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${String(apiKey || "").trim()}`,
          },
          body: JSON.stringify(body),
        },
        displayBody: maskLongImageUrls(body),
      };
    }

    const body = {
      model: String(model || "").trim(),
      prompt: String(prompt || "").trim(),
      size: String(size || "1024x1024").trim(),
      n: 1,
      response_format: String(responseFormat || "url").trim(),
    };

    return {
      url,
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${String(apiKey || "").trim()}`,
        },
        body: JSON.stringify(body),
      },
      displayBody: body,
    };
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function maskLongImageUrls(value) {
    return JSON.parse(
      JSON.stringify(value, (key, currentValue) => {
        if (
          key === "url" &&
          typeof currentValue === "string" &&
          currentValue.startsWith("data:image/")
        ) {
          return `${currentValue.slice(0, 80)}... (length=${currentValue.length})`;
        }
        return currentValue;
      }),
    );
  }

  function extractImageResults(responseJson) {
    const data = Array.isArray(responseJson?.data) ? responseJson.data : [];

    return data.flatMap((item) => {
      if (item?.url) {
        return [{ type: "url", value: item.url }];
      }

      if (item?.b64_json) {
        return [{ type: "base64", value: item.b64_json }];
      }

      return [];
    });
  }

  function maskApiKey(apiKey) {
    const value = String(apiKey || "").trim();
    if (value.length <= 8) return value ? "****" : "";
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  function buildCurlCommand(request, apiKey) {
    const masked = maskApiKey(apiKey);
    return [
      `curl -X POST "${request.url}"`,
      `  -H "Content-Type: application/json"`,
      `  -H "Authorization: Bearer ${masked}"`,
      `  -d '${request.options.body}'`,
    ].join(" \\\n");
  }

  function toDisplayRequest(request, apiKey) {
    return {
      url: request.url,
      options: {
        ...request.options,
        headers: {
          ...request.options.headers,
          Authorization: `Bearer ${maskApiKey(apiKey)}`,
        },
        body: request.displayBody || JSON.parse(request.options.body),
      },
    };
  }

  async function sendImageGenerationRequest(formData) {
    const request = formData.experimentMode
      ? await buildImageExperimentRequest(formData)
      : buildImageGenerationRequest(formData);
    const response = await fetch(request.url, request.options);
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    const responseBody = contentType.includes("application/json")
      ? JSON.parse(rawText)
      : rawText;

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      responseBody,
      imageResults:
        typeof responseBody === "object" ? extractImageResults(responseBody) : [],
      displayRequest: toDisplayRequest(request, formData.apiKey),
      curlCommand: buildCurlCommand(request, formData.apiKey),
    };
  }

  const api = {
    joinUrl,
    buildImageGenerationRequest,
    buildImageExperimentRequest,
    extractImageResults,
    maskApiKey,
    buildCurlCommand,
    toDisplayRequest,
    sendImageGenerationRequest,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.ImageApiTester = api;
})(typeof window !== "undefined" ? window : globalThis);

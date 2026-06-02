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
    apiKey,
    model,
    prompt,
    size,
    responseFormat,
    experimentMode,
    imageFiles,
  }) {
    const url = joinUrl(baseUrl, endpoint || "/images/generations");
    const mode = experimentMode || "json";
    const files = Array.from(imageFiles || []);

    if (mode === "multipart") {
      const body = new FormData();
      body.append("model", String(model || "").trim());
      body.append("prompt", String(prompt || "").trim());
      body.append("size", String(size || "1024x1024").trim());
      body.append("n", "1");
      body.append("response_format", String(responseFormat || "url").trim());
      body.append(
        "image_order",
        JSON.stringify(
          files.map((file, index) => ({
            index: index + 1,
            name: file.name,
            type: file.type,
          })),
        ),
      );
      for (const file of files) {
        body.append("image", file, file.name);
      }

      return {
        url,
        options: {
          method: "POST",
          headers: {
            Authorization: `Bearer ${String(apiKey || "").trim()}`,
          },
          body,
        },
        displayBody: {
          mode,
          fields: {
            model,
            prompt,
            size,
            n: 1,
            response_format: responseFormat,
          },
          files: files.map((file, index) => ({
            field: "image",
            index: index + 1,
            name: file.name,
            type: file.type,
            size: file.size,
          })),
        },
      };
    }

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

    if (mode === "json_image_urls") {
      body.input_images = files.map((file, index) => ({
        index: index + 1,
        url: URL.createObjectURL(file),
        name: file.name,
        mime_type: file.type,
      }));
    }

    if (mode === "json_base64") {
      body.input_images = await Promise.all(
        files.map(async (file, index) => ({
          index: index + 1,
          b64_json: await fileToBase64(file),
          name: file.name,
          mime_type: file.type,
        })),
      );
    }

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
    const isMultipart =
      typeof FormData !== "undefined" && request.options.body instanceof FormData;
    if (isMultipart) {
      return [
        `curl -X POST "${request.url}"`,
        `  -H "Authorization: Bearer ${masked}"`,
        `  -F "model=<model>"`,
        `  -F "prompt=<prompt>"`,
        `  -F "size=<size>"`,
        `  -F "response_format=<url|b64_json>"`,
        `  -F "image=@/path/to/reference.png"`,
      ].join(" \\\n");
    }

    return [
      `curl -X POST "${request.url}"`,
      `  -H "Content-Type: application/json"`,
      `  -H "Authorization: Bearer ${masked}"`,
      `  -d '${request.options.body}'`,
    ].join(" \\\n");
  }

  function toDisplayRequest(request, apiKey) {
    const isMultipart =
      typeof FormData !== "undefined" && request.options.body instanceof FormData;
    return {
      url: request.url,
      options: {
        ...request.options,
        headers: {
          ...request.options.headers,
          Authorization: `Bearer ${maskApiKey(apiKey)}`,
        },
        body: isMultipart
          ? request.displayBody || "multipart/form-data"
          : JSON.parse(request.options.body),
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

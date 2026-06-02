export type ResponseFormat = "url" | "b64_json";
export type ImageInputMode = "chat_messages" | "json_base64" | "multipart";

export type ProviderConfig = {
  baseUrl: string;
  endpoint: string;
  model: string;
  size: string;
  responseFormat: ResponseFormat;
  imageInputMode: ImageInputMode;
  group: string;
  stream: boolean;
};

export type SavedProviderConfig = ProviderConfig & {
  id: string;
  name: string;
};

export type DebugLogEntry = {
  id: string;
  createdAt: string;
  summary: string;
  details?: string;
};

export type DebugLogPayload = {
  summary: string;
  details?: unknown;
};

export type SupportedImageMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export type ImageInput = {
  index: number;
  localUri: string;
  mimeType: SupportedImageMimeType;
  displayName?: string;
  base64Data?: string;
};

export type GenerationRequest = {
  provider: ProviderConfig;
  apiKey: string;
  prompt: string;
  inputImages: ImageInput[];
};

export type ImageResult = {
  type: "url" | "base64" | "local";
  value: string;
};

export type GenerationStatus = "success" | "failed" | "cancelled";

export type GenerationHistory = {
  id: string;
  prompt: string;
  provider: ProviderConfig;
  inputImages: ImageInput[];
  outputImages: ImageResult[];
  status: GenerationStatus;
  errorMessage?: string;
  createdAt: string;
};

export const defaultProviderConfig: ProviderConfig = {
  baseUrl: "https://www.micuapi.ai/v1",
  endpoint: "/chat/completions",
  model: "gpt-image-2-pro",
  size: "1024x1024",
  responseFormat: "url",
  imageInputMode: "chat_messages",
  group: "vip_2_image",
  stream: true,
};

export const commonImageSizes = [
  "1024x1024",
  "1024x1792",
  "1792x1024",
  "512x512",
] as const;

export const commonModelNames = [
  "gpt-image-2-pro",
  "gpt-image-2",
  "image2",
  "gpt-image-1",
  "dall-e-3",
  "dall-e-2",
] as const;

export const defaultSavedProviderConfigs: SavedProviderConfig[] = [
  {
    id: "default-image2",
    name: "Image2 默认",
    ...defaultProviderConfig,
  },
];

# RN + Expo MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 React Native + Expo 实现一个可独立运行的 Image2 安卓 MVP，支持本地配置中转站 Key、文生图、多图参考输入、取消旧请求、本地历史和导出相册。

**Architecture:** Expo App 放在仓库根目录，保留已有 `index.html` 静态接口测试页。业务代码拆到 `src/`：API Provider、任务管理、历史存储、图片存储和 UI 组件彼此独立，便于后续替换后端代理或新增 Provider。

**Tech Stack:** React Native、Expo、TypeScript、Zustand、expo-secure-store、expo-image-picker、expo-file-system、expo-media-library、expo-sqlite、expo-image、Vitest。

---

## 0. 环境要求

- Node.js 20+
- npm 10+
- Expo Go 手机 App，或 Android Studio 模拟器
- 当前仓库路径：`c:\Users\54\Desktop\pageplug\image2ForAndroid`

验证环境：

```bash
node --version
npm --version
```

## 1. 需要安装的包

运行：

```bash
npm install expo react react-native @expo/vector-icons zustand
npm install expo-secure-store expo-image-picker expo-file-system expo-media-library expo-sqlite expo-image
npm install -D typescript vitest @types/react
```

用途：

- `expo`：Expo 运行时与 CLI。
- `react` / `react-native`：RN 基础运行库。
- `@expo/vector-icons`：底部导航和按钮图标。
- `zustand`：轻量状态管理。
- `expo-secure-store`：加密保存 API Key。
- `expo-image-picker`：选择本地图片。
- `expo-file-system`：保存生成图到 App 私有存储。
- `expo-media-library`：导出图片到系统相册。
- `expo-sqlite`：保存历史记录元数据。
- `expo-image`：图片预览与缓存。
- `typescript`：类型检查。
- `vitest`：测试纯业务逻辑。
- `@types/react`：React 类型。

## 2. 需要创建和修改的文件

### Expo 配置

- Create `package.json`：npm scripts、依赖、测试命令。
- Create `app.json`：Expo App 名称、权限说明、Android 包名。
- Create `tsconfig.json`：TypeScript 配置。
- Create `babel.config.js`：Expo Babel 配置。
- Create `App.tsx`：App 入口。

### 业务代码

- Create `src/types.ts`：核心类型。
- Create `src/api/openAiImageProvider.ts`：OpenAI-compatible 请求和响应解析。
- Create `src/api/openAiImageProvider.test.ts`：Provider 纯逻辑测试。
- Create `src/security/credentialStore.ts`：API Key 安全存储。
- Create `src/storage/imageStorage.ts`：输出图片保存和导出。
- Create `src/storage/historyStore.ts`：SQLite 历史记录。
- Create `src/tasks/generationTaskManager.ts`：当前任务与取消逻辑。
- Create `src/store/useAppStore.ts`：全局状态。
- Create `src/ui/ConfigScreen.tsx`：配置页。
- Create `src/ui/GenerateScreen.tsx`：生成页。
- Create `src/ui/HistoryScreen.tsx`：历史页。
- Create `src/ui/components.tsx`：通用 UI 组件。

### 文档

- Modify `README.md`：补充 RN + Expo 技术选型、启动命令和验证命令。

## 3. 数据结构

`src/types.ts` 定义：

```ts
export type ResponseFormat = "url" | "b64_json";

export type ProviderConfig = {
  baseUrl: string;
  endpoint: string;
  model: string;
  size: string;
  responseFormat: ResponseFormat;
};

export type ImageInput = {
  index: number;
  localUri: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  displayName?: string;
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

export type GenerationHistory = {
  id: string;
  prompt: string;
  provider: ProviderConfig;
  inputImages: ImageInput[];
  outputImages: ImageResult[];
  status: "success" | "failed" | "cancelled";
  errorMessage?: string;
  createdAt: string;
};
```

## 4. 执行步骤

### Task 1: 初始化 Expo 工程配置

- [ ] 创建 `package.json`，包含这些 scripts：

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "web": "expo start --web",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] 创建 `app.json`，配置 Android 权限：

```json
{
  "expo": {
    "name": "Image2ForAndroid",
    "slug": "image2-for-android",
    "version": "0.1.0",
    "orientation": "portrait",
    "android": {
      "package": "com.pageplug.image2forandroid",
      "permissions": ["READ_MEDIA_IMAGES", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"]
    },
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "选择参考图片用于 AI 作图。"
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "保存生成图片到系统相册。",
          "savePhotosPermission": "保存生成图片到系统相册。"
        }
      ]
    ]
  }
}
```

- [ ] 创建 TypeScript 和 Babel 配置。
- [ ] 安装依赖。

### Task 2: 用 TDD 实现 Provider 纯逻辑

- [ ] 先写 `src/api/openAiImageProvider.test.ts`，覆盖：
  - URL 拼接不会产生双斜杠。
  - 文生图请求体包含 `model`、`prompt`、`size`、`n`、`response_format`。
  - 响应解析支持 `data[].url` 和 `data[].b64_json`。
  - 多图请求保留输入图片顺序。
- [ ] 运行 `npm test`，预期失败，因为实现文件还不存在。
- [ ] 创建 `src/api/openAiImageProvider.ts`，实现测试要求。
- [ ] 再运行 `npm test`，预期通过。

### Task 3: 实现安全配置与本地状态

- [ ] 创建 `src/security/credentialStore.ts`，使用 `expo-secure-store` 保存、读取、删除 API Key。
- [ ] 创建 `src/store/useAppStore.ts`，保存：
  - 当前 Provider 配置。
  - 当前 prompt。
  - 当前输入图片。
  - 当前输出图片。
  - 当前加载状态和错误信息。
- [ ] `apiKey` 不放入历史记录，只通过 `CredentialStore` 读写。

### Task 4: 实现图片存储和历史记录

- [ ] 创建 `src/storage/imageStorage.ts`：
  - URL 图片下载到 App 私有目录。
  - base64 图片写入 App 私有目录。
  - App 私有图片导出到系统相册。
- [ ] 创建 `src/storage/historyStore.ts`：
  - 初始化 SQLite 表。
  - 新增历史记录。
  - 查询历史记录。
  - 保存 `inputImages` 和 `outputImages` 为 JSON 字符串。

### Task 5: 实现任务取消与重新生成

- [ ] 创建 `src/tasks/generationTaskManager.ts`：
  - 使用 `AbortController` 管理当前请求。
  - 新请求开始时取消旧请求。
  - 旧请求取消后不覆盖上一次成功结果。
  - 新请求成功后保存新历史项。

### Task 6: 实现 UI

- [ ] 创建 `src/ui/ConfigScreen.tsx`：
  - 输入 `baseUrl`、`endpoint`、`apiKey`、`model`、`size`、`responseFormat`。
  - 保存配置和 API Key。
- [ ] 创建 `src/ui/GenerateScreen.tsx`：
  - 输入 prompt。
  - 选择多张 PNG/JPG/WEBP 图片。
  - 显示“图 1 / 图 2 / 图 3”。
  - 发起生成请求。
  - 显示加载、错误和输出图片。
  - 支持从当前结果再次编辑并重新生成。
- [ ] 创建 `src/ui/HistoryScreen.tsx`：
  - 展示历史列表。
  - 回看 prompt、参数、输入图片和输出图片。
  - 支持导出图片到相册。
  - 支持把历史项带回生成页再次编辑。
- [ ] 创建 `App.tsx`：
  - 简单三 Tab：生成、历史、设置。
  - 启动时初始化历史数据库和读取保存配置。

### Task 7: 更新文档

- [ ] 在 `README.md` 增加：
  - 技术选型：React Native + Expo。
  - 安装命令。
  - 启动命令。
  - 测试命令。
  - Android 真机调试说明。

### Task 8: 验证

- [ ] 运行：

```bash
npm test
npm run typecheck
```

- [ ] 手动验证：
  - `npm start` 启动 Expo。
  - 手机 Expo Go 扫码打开。
  - 设置页保存中转站配置和 API Key。
  - 生成页输入 prompt，完成文生图。
  - 选择多张图片后，确认 UI 显示顺序编号。
  - 发起新请求时旧请求被取消。
  - 成功结果进入历史。
  - 重启 App 后历史仍存在。
  - 点击下载后图片进入系统相册。

## 5. MVP 验收标准

- 无后端也可以独立使用。
- 用户能配置中转站信息和 API Key。
- 能调用 OpenAI-compatible 生图接口。
- 能解析 `data[].url` 和 `data[].b64_json`。
- 能展示多张输入图片顺序。
- 能保存并回看本地历史。
- 能重新编辑提示词并生成新结果。
- 新请求会取消旧请求。
- 能导出生成图到系统相册。

## 6. 实施注意事项

- 不把 API Key 写入日志、SQLite 历史或错误提示。
- 第一版只支持 PNG、JPG/JPEG、WEBP。
- 第一版不做后端代理、登录、云同步、局部重绘、画布编辑。
- 如果目标接口不支持图生图或多图输入，Provider 必须返回清晰错误，而不是静默失败。

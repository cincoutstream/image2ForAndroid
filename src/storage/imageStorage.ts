import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";

import type { ImageResult } from "../types";

const OUTPUT_DIR = `${FileSystem.documentDirectory ?? ""}generated/`;

async function ensureOutputDir(): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error("当前环境不支持 App 私有文件目录。");
  }

  const dirInfo = await FileSystem.getInfoAsync(OUTPUT_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(OUTPUT_DIR, { intermediates: true });
  }
}

function createImageFileName(extension: string): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
}

export async function persistImageResult(result: ImageResult): Promise<ImageResult> {
  if (result.type === "local") {
    return result;
  }

  await ensureOutputDir();

  if (result.type === "url") {
    const extension = result.value.split("?")[0]?.split(".").pop() || "png";
    const targetUri = `${OUTPUT_DIR}${createImageFileName(extension)}`;
    const downloaded = await FileSystem.downloadAsync(result.value, targetUri);
    return { type: "local", value: downloaded.uri };
  }

  const targetUri = `${OUTPUT_DIR}${createImageFileName("png")}`;
  await FileSystem.writeAsStringAsync(targetUri, result.value, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { type: "local", value: targetUri };
}

export async function persistImageResults(
  results: ImageResult[],
): Promise<ImageResult[]> {
  return Promise.all(results.map((result) => persistImageResult(result)));
}

export async function exportImageToLibrary(localUri: string): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error("没有相册写入权限，无法导出图片。");
  }

  await MediaLibrary.saveToLibraryAsync(localUri);
}

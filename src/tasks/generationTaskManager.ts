import { generateImages } from "../api/openAiImageProvider";
import { addHistoryItem } from "../storage/historyStore";
import { persistImageResults } from "../storage/imageStorage";
import type { DebugLogPayload, GenerationHistory, GenerationRequest } from "../types";

let activeController: AbortController | null = null;
let activeRunId = 0;

function createHistoryItem(
  request: GenerationRequest,
  status: GenerationHistory["status"],
  outputImages: GenerationHistory["outputImages"],
  errorMessage?: string,
): GenerationHistory {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    prompt: request.prompt,
    provider: request.provider,
    inputImages: request.inputImages,
    outputImages,
    status,
    errorMessage,
    createdAt: new Date().toISOString(),
  };
}

export function cancelActiveGeneration(): void {
  activeController?.abort();
  activeController = null;
}

export async function runGenerationTask(
  request: GenerationRequest,
  onDebug?: (payload: DebugLogPayload) => void,
): Promise<GenerationHistory | null> {
  cancelActiveGeneration();

  const runId = activeRunId + 1;
  activeRunId = runId;
  activeController = new AbortController();

  try {
    const remoteResults = await generateImages(
      request,
      activeController.signal,
      onDebug,
    );
    if (runId !== activeRunId) {
      return null;
    }

    const localResults = await persistImageResults(remoteResults);
    if (runId !== activeRunId) {
      return null;
    }

    const historyItem = createHistoryItem(request, "success", localResults);
    await addHistoryItem(historyItem);
    return historyItem;
  } catch (error) {
    if (activeController.signal.aborted || runId !== activeRunId) {
      return null;
    }

    const historyItem = createHistoryItem(
      request,
      "failed",
      [],
      error instanceof Error ? error.message : "生成失败。",
    );
    await addHistoryItem(historyItem);
    return historyItem;
  } finally {
    if (runId === activeRunId) {
      activeController = null;
    }
  }
}

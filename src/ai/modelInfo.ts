/**
 * The on-device model. Verified against the Hugging Face API (2026-10-10):
 * repo Qwen/Qwen2.5-0.5B-Instruct-GGUF, Apache-2.0, file
 * qwen2.5-0.5b-instruct-q4_k_m.gguf, 491,400,032 bytes, LFS SHA-256 below.
 * The download URL is pinned to a commit so the file can't change underneath us.
 */
export const MODEL = {
  id: 'qwen2.5-0.5b-instruct-q4_k_m',
  name: 'Qwen2.5 0.5B Instruct',
  quantization: 'Q4_K_M (GGUF)',
  license: 'Apache-2.0',
  publisher: 'Qwen (Alibaba Cloud)',
  fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
  revision: '9217f5db79a29953eb74d5343926648285ec7e67',
  sizeBytes: 491_400_032,
  sha256: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
  get url() {
    return `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/${this.revision}/${this.fileName}`;
  },
} as const;

/** Inference limits sized for a 0.5B model on an iPhone 14 Plus / Pro Max (6 GB RAM). */
export const LIMITS = {
  /** Context window. Prompts are built to stay well under it. */
  nCtx: 2048,
  nBatch: 512,
  /** Offload every layer to Metal. */
  nGpuLayers: 99,
  routerTokens: 160,
  chatTokens: 120,
  answerTokens: 160,
  summaryTokens: 200,
  /** Release the model after this long without a request (memory / battery). */
  idleUnloadMs: 90_000,
  /** Give up on a single completion after this long. */
  timeoutMs: 45_000,
} as const;

/** Qwen2.5 chat-template end tokens. */
export const STOP_WORDS = ['<|im_end|>', '<|endoftext|>', '<|im_start|>'];

export const formatBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.round(n / 1e6)} MB`);

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Evita que o bundler tente processar o ONNX runtime e os binários nativos
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
};

export default nextConfig;

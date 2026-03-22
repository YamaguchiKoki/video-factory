// Stub environment variables consumed at module load time to prevent
// startup validation errors during test runs.
// These must be set before any module that reads process.env is imported.
process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "test-tavily-key";
process.env.XAI_API_KEY = process.env.XAI_API_KEY ?? "test-xai-key";

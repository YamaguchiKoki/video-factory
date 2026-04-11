// Stub environment variables consumed at module load time to prevent
// startup validation errors during test runs.
// These must be set before any module that reads process.env is imported.
process.env.S3_BUCKET = process.env.S3_BUCKET ?? "test-bucket";

import type { Result } from "neverthrow";

type EntrypointError = {
  readonly type: string;
  readonly message: string;
};

export const handleResult = <E extends EntrypointError>(
  result: Result<unknown, E>,
): void => {
  if (result.isErr()) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        type: result.error.type,
        message: result.error.message,
      }),
    );
    process.exit(1);
  }
};

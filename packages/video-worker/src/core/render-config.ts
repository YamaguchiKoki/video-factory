export type CompositionConfig = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
};

export type RenderConfig = {
  readonly composition: CompositionConfig;
  readonly serveUrl: string;
  readonly inputProps: Record<string, unknown>;
  readonly codec: "h264";
  readonly crf: number;
  readonly imageFormat: "jpeg";
  readonly timeoutInMilliseconds: number;
  readonly concurrency: number;
  readonly enableMultiProcessOnLinux: boolean;
};

export interface CompositionConfig {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface RenderConfig {
  composition: CompositionConfig;
  serveUrl: string;
  inputProps: Record<string, unknown>;
  codec: "h264";
  crf: number;
  imageFormat: "jpeg";
  timeoutInMilliseconds: number;
  concurrency: number;
  enableMultiProcessOnLinux: boolean;
}

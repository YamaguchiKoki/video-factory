// See all configuration options: https://remotion.dev/docs/config
// Each option also is available as a CLI flag: https://remotion.dev/docs/cli

// Note: When using the Node.JS APIs, the config file doesn't apply. Instead, pass options directly to the APIs

import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./src/infrastructure/webpack-override";

Config.setEntryPoint("./src/remotion/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// 設定の実体は webpack-override.ts に置き、bundle() を直接呼ぶ経路と共有する。
// ここに直書きすると片方だけ更新される事故が起きる。
Config.overrideWebpackConfig(webpackOverride);

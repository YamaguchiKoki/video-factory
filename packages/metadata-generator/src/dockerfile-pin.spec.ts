// Tests for Dockerfile / installed-package version drift.
//
// Design contract:
//   The Dockerfile hardcodes an exact "@napi-rs/canvas@X.Y.Z" version to
//   `npm install` into the Lambda image (package.json only pins a "^1.0.8"
//   range, so the two can drift independently — e.g. a routine `pnpm update`
//   moves the locally resolved version forward while the Dockerfile keeps
//   shipping the old one). If that happens, what's tested locally silently
//   stops being what runs in Lambda.
//
//   This guards against that drift by comparing:
//     — the version actually installed in node_modules (what the code and
//       the other tests in this package actually run against)
//     — the version string hardcoded in the Dockerfile's npm install line
//   and failing loudly, with both values named, if they disagree.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

const installedVersion = (): string => {
  const pkgPath = `${packageRoot}/node_modules/@napi-rs/canvas/package.json`;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    version: string;
  };
  return pkg.version;
};

const dockerfilePinnedVersion = (): string => {
  const dockerfilePath = `${packageRoot}/Dockerfile`;
  const dockerfile = readFileSync(dockerfilePath, "utf-8");
  const match = dockerfile.match(/@napi-rs\/canvas@(\d+\.\d+\.\d+)/);
  const version = match?.[1];
  if (version === undefined) {
    throw new Error(
      `Could not find an "@napi-rs/canvas@X.Y.Z" version pin in ${dockerfilePath}`,
    );
  }
  return version;
};

describe("Dockerfile @napi-rs/canvas version pin", () => {
  it("matches the version actually installed in node_modules", () => {
    const installed = installedVersion();
    const pinned = dockerfilePinnedVersion();

    expect(
      pinned,
      `Dockerfile pins @napi-rs/canvas@${pinned} but node_modules has ` +
        `@napi-rs/canvas@${installed} installed. Update the ` +
        `"npm install ... @napi-rs/canvas@${pinned}" line in ` +
        "packages/metadata-generator/Dockerfile to match.",
    ).toBe(installed);
  });
});

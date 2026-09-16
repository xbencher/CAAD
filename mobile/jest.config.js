const preset = require("jest-expo/jest-preset");

// msw v2 pulls in ESM-only transitive deps (rettime, @open-draft/deferred-promise)
// that have no CJS fallback. Two fixes are needed:
//
// 1. transformIgnorePatterns: extend the preset allowlist so those packages are
//    transformed by Babel instead of passed through raw.
//
// 2. transform: jest-expo only transforms [jt]sx? files by default; rettime
//    ships only .mjs files, so we must extend the babel-jest transform pattern
//    to include .mjs as well.
//
// 3. moduleNameMapper: redirect `msw/node` to the pre-built CJS entry so Jest
//    never has to resolve the package exports map (which would pick the ESM
//    build under Jest's environment).
const [defaultIgnorePattern, ...restIgnorePatterns] = preset.transformIgnorePatterns;
const extendedIgnorePattern = defaultIgnorePattern.replace(
  "(?!(",
  "(?!(rettime|until-async|headers-polyfill|@open-draft/deferred-promise|",
);

// Find the babel-jest entry and widen its file-extension regex to include .mjs.
const extendedTransform = Object.fromEntries(
  Object.entries(preset.transform ?? {}).map(([pattern, transformer]) => {
    const newPattern = pattern.replace("[jt]sx?", "[jt]sx?|mjs");
    return [newPattern, transformer];
  }),
);

module.exports = {
  ...preset,
  transform: extendedTransform,
  transformIgnorePatterns: [extendedIgnorePattern, ...restIgnorePatterns],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Use the pre-built CJS bundle for msw/node so Jest doesn't hit the
    // ESM-only exports map path.
    "^msw/node$": "<rootDir>/node_modules/msw/lib/node/index.js",
  },
};

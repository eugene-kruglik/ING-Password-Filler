// Keeps public/manifest.json in sync with the version in package.json.
// Run automatically by the `version` npm lifecycle script.
const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "public", "manifest.json");
const version = process.env.npm_package_version;

if (!version) {
  console.error("npm_package_version is not set - run this through npm, not node directly.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

manifest.version = version;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`manifest.json version set to ${version}`);

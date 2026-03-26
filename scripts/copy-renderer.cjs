const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "renderer");
const dest = path.join(__dirname, "..", "dist", "renderer");
const assetsSrc = path.join(__dirname, "..", "assets");
const assetsDest = path.join(__dirname, "..", "dist", "assets");

if (!fs.existsSync(src)) {
  console.error("copy-renderer: kaynak yok:", src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("copy-renderer: ok ->", dest);

if (fs.existsSync(assetsSrc)) {
  fs.mkdirSync(path.dirname(assetsDest), { recursive: true });
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  console.log("copy-renderer: assets ok ->", assetsDest);
}

const fs = require("fs");
const path = require("path");

async function main() {
  const pngToIco = require("png-to-ico");

  const root = path.join(__dirname, "..");
  const pngPath = path.join(root, "assets", "icon.png");
  const icoPath = path.join(root, "assets", "icon.ico");

  if (!fs.existsSync(pngPath)) {
    console.error("gen-icon: icon.png bulunamadı:", pngPath);
    process.exit(1);
  }

  const buf = await pngToIco(pngPath);
  fs.writeFileSync(icoPath, buf);
  console.log("gen-icon: ok ->", icoPath);
}

main().catch((e) => {
  console.error("gen-icon: hata:", e?.message || e);
  process.exit(1);
});


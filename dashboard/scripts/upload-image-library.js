require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const fs = require("fs");
const path = require("path");
const { put } = require("@vercel/blob");
const db = require("../db/client");

const SOURCES = [
  { dir: path.join(__dirname, "..", "..", "assets", "kho-anh", "KOLAI"), folder: "KOLAI" },
  { dir: path.join(__dirname, "..", "..", "assets", "kho-anh", "Hình ảnh kết nối, Sự kiện, Đào tạo"), folder: "Su kien" },
];

function contentTypeFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function main() {
  await db.ensureSchema();
  const existing = await db.listLibraryImages();
  const existingNames = new Set(existing.map((img) => `${img.folder}/${img.file_name}`));

  let uploaded = 0;
  for (const { dir, folder } of SOURCES) {
    const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
    console.log(`[${folder}] Tim thay ${files.length} anh`);

    for (const fileName of files) {
      if (existingNames.has(`${folder}/${fileName}`)) continue;
      const filePath = path.join(dir, fileName);
      const buffer = fs.readFileSync(filePath);
      const blob = await put(`library/${folder}/${fileName}`, buffer, {
        access: "public",
        contentType: contentTypeFor(fileName),
        addRandomSuffix: false,
      });
      await db.addLibraryImage({ fileName, folder, url: blob.url });
      uploaded += 1;
      console.log(`Da tai len: ${folder}/${fileName}`);
    }
  }
  console.log(`Xong. Da tai len ${uploaded} anh moi.`);
}

main().catch((err) => {
  console.error("Loi:", err);
  process.exit(1);
});

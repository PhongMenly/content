const { put, del } = require("@vercel/blob");

async function uploadImageBuffer(fileName, buffer, contentType) {
  const blob = await put(`posts/${Date.now()}-${fileName}`, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return blob.url;
}

async function uploadImageFromPath(fs, filePath, fileName) {
  const buffer = fs.readFileSync(filePath);
  return uploadImageBuffer(fileName, buffer);
}

async function deleteImage(url) {
  await del(url);
}

module.exports = { uploadImageBuffer, uploadImageFromPath, deleteImage };

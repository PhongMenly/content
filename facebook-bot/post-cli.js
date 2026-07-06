require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { postText, postPhoto } = require("./fb-api");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const hasValue = argv[i + 1] !== undefined && !argv[i + 1].startsWith("--");
      args[key] = hasValue ? argv[++i] : true;
    }
  }
  return args;
}

function toUnixTime(scheduleArg) {
  const date = new Date(scheduleArg);
  if (isNaN(date.getTime())) {
    throw new Error(`Khong doc duoc thoi gian: ${scheduleArg}. Dung dinh dang "2026-07-05 09:00"`);
  }
  const unix = Math.floor(date.getTime() / 1000);
  const minAllowed = Math.floor(Date.now() / 1000) + 600;
  if (unix < minAllowed) {
    throw new Error("Facebook yeu cau lich dang toi thieu 10 phut sau thoi diem hien tai");
  }
  return unix;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args["text-file"]) {
    console.error("Thieu --text-file <duong dan file noi dung bai viet>");
    process.exit(1);
  }

  const pageId = process.env.FB_PAGE_ID;
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !pageAccessToken) {
    console.error("Thieu FB_PAGE_ID hoac FB_PAGE_ACCESS_TOKEN trong .env");
    process.exit(1);
  }

  const message = fs.readFileSync(path.resolve(args["text-file"]), "utf-8").trim();
  const scheduledTime = args.schedule ? toUnixTime(args.schedule) : undefined;

  const result = args.image
    ? await postPhoto({
        pageId,
        pageAccessToken,
        message,
        imagePath: path.resolve(args.image),
        scheduledTime,
      })
    : await postText({ pageId, pageAccessToken, message, scheduledTime });

  if (scheduledTime) {
    console.log(`Da len lich dang luc ${args.schedule} (post id: ${result.id || result.post_id})`);
  } else {
    console.log(`Da dang thanh cong (post id: ${result.id || result.post_id})`);
  }
}

main().catch((err) => {
  console.error("Loi:", err.message);
  process.exit(1);
});

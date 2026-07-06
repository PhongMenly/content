require("dotenv").config();
const { exchangeLongLivedUserToken, getPageAccessToken } = require("./fb-api");

async function main() {
  const shortLivedToken = process.argv[2];
  if (!shortLivedToken) {
    console.error("Dung: node token-setup.js <SHORT_LIVED_USER_TOKEN_TU_GRAPH_API_EXPLORER>");
    process.exit(1);
  }

  const { FB_APP_ID, FB_APP_SECRET, FB_PAGE_ID } = process.env;
  if (!FB_APP_ID || !FB_APP_SECRET || !FB_PAGE_ID) {
    console.error("Thieu FB_APP_ID, FB_APP_SECRET hoac FB_PAGE_ID trong .env");
    process.exit(1);
  }

  console.log("Dang doi sang long-lived user token...");
  const longLivedUserToken = await exchangeLongLivedUserToken({
    shortLivedToken,
    appId: FB_APP_ID,
    appSecret: FB_APP_SECRET,
  });

  console.log("Dang lay Page Access Token...");
  const pageAccessToken = await getPageAccessToken({
    longLivedUserToken,
    pageId: FB_PAGE_ID,
  });

  console.log("\nThanh cong. Dan dong sau vao file .env:\n");
  console.log(`FB_PAGE_ACCESS_TOKEN=${pageAccessToken}`);
}

main().catch((err) => {
  console.error("Loi:", err.message);
  process.exit(1);
});

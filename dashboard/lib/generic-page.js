/**
 * Doc noi dung van ban tu 1 trang web bat ky (khong can API key).
 *
 * 2 buoc:
 * 1. Fetch HTML tho ma server tra ve (nhanh, khong ton chi phi khoi dong browser).
 * 2. Neu qua it noi dung (co the trang render bang JavaScript phia client, vd
 *    TikTok/Instagram profile cong khai) -> fallback mo headless Chromium that,
 *    cho JS chay xong roi doc noi dung da hien ra.
 *
 * GIOI HAN THAT (khong sua duoc du dung headless browser): trang yeu cau dang
 * nhap moi xem duoc (vd Facebook ca nhan) van KHONG doc duoc, vi khong co phien
 * dang nhap that. Truong hop nay phai dung "dan text truc tiep"
 * (xem routes/settings.js /brand-profile/analyze-text).
 */

const MIN_TEXT_LENGTH = 100;

function stripHtml(html) {
  const title = ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "").trim();
  const metaDesc = ((html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || [])[1] || "").trim();

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > 6000) text = text.slice(0, 6000);
  return { title, metaDesc, text };
}

async function fetchPlainHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`Khong tai duoc trang (HTTP ${res.status})`);
  return res.text();
}

// Mo trang bang headless Chromium that, cho JS chay xong roi lay noi dung van ban
// da hien ra (khac voi fetch thuong chi doc duoc HTML server tra ve ban dau).
// Require lazy (chi luc goi ham) de khong lam nang cac route khac neu co su co.
async function renderWithHeadlessBrowser(url) {
  // @sparticuz/chromium chi tu giai nen cac thu vien dung chung (libnss3.so...) va
  // set LD_LIBRARY_PATH khi phat hien dang chay tren AWS Lambda qua bien moi truong
  // AWS_EXECUTION_ENV/AWS_LAMBDA_JS_RUNTIME. Vercel khong tu dat 2 bien nay nen buoc
  // giai nen bi bo qua hoan toan -> thieu libnss3.so khi khoi dong Chromium.
  // Gia lap gia tri de ep buoc giai nen chay (nhanh "khong phai 20.x" -> dung goi AL2).
  if (!process.env.AWS_EXECUTION_ENV) {
    process.env.AWS_EXECUTION_ENV = "AWS_Lambda_nodejs20.x";
  }

  const chromium = require("@sparticuz/chromium");
  const puppeteer = require("puppeteer-core");

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    // "networkidle2" cho trang co ket noi nen lien tuc (vd TikTok chong bot) se khong bao gio
    // "idle", gay timeout du DOM da san sang. Dung "domcontentloaded" (chi cho DOM parse xong)
    // roi doi them 1 nhip ngan cho JS kip render, khong doi mang phai im hoan toan.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 3000));
    const title = await page.title();
    const text = await page.evaluate(() => document.body.innerText);
    return { title, metaDesc: "", text: (text || "").replace(/\s+/g, " ").trim().slice(0, 6000) };
  } finally {
    await browser.close();
  }
}

async function fetchGenericPageText(url) {
  const html = await fetchPlainHtml(url);
  let { title, metaDesc, text } = stripHtml(html);

  // Chi can co <title> la khong du de ket luan "doc duoc noi dung" — hau nhu trang
  // JS-heavy nao cung co title tinh trong khi phan than trang van rong. Phai doi hoi
  // chinh phan text (noi dung than trang) du dai thi moi coi la fetch thuong da thanh cong.
  if (text.length >= MIN_TEXT_LENGTH) {
    return { url, title, metaDesc, text };
  }

  // Fetch thuong khong du noi dung -> thu render bang headless browser (co the la trang JS-heavy)
  try {
    const rendered = await renderWithHeadlessBrowser(url);
    if (rendered.text.length >= MIN_TEXT_LENGTH) {
      return { url, title: rendered.title, metaDesc: rendered.metaDesc, text: rendered.text };
    }
    console.error(`[generic-page] Render tra ve qua it noi dung: title="${rendered.title}" textLen=${rendered.text.length}`);
  } catch (err) {
    // Render cung loi (vd trang chan headless, timeout...) -> roi xuong bao loi ben duoi
    console.error(`[generic-page] Headless render LOI: ${err && err.stack ? err.stack : err}`);
  }

  throw new Error(
    "Trang nay khong doc duoc noi dung (co the can dang nhap — vi du Facebook ca nhan khong doc duoc du dung cach nao — hoac chan truy cap tu dong). Neu la noi dung can dang nhap, dung cach 'dan noi dung truc tiep' thay vi dan link."
  );
}

module.exports = { fetchGenericPageText };

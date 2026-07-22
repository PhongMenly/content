/**
 * May canh YouTube: co video moi tren kenh cua anh Phong -> tu gioi thieu len
 * kenh Telegram cong dong "KOL AI GO GLOBAL".
 *
 * Dung RSS chinh thuc cua YouTube (khong can API key, khong ton han muc).
 * Nhi viet vai dong gioi thieu theo giong thuong hieu, kem anh thumbnail + link.
 */
const db = require("../../db/client");
const { chatComplete } = require("../ai");
const { sendPhotoToChannel } = require("./channel-broadcast");

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "UC2GRYuA71V4OoeGuPnPsU9A"; // @Phongmenlyaigoglobalus
const STATE_KEY = "youtube_sent_videos";
// Lan chay dau tien chi ghi nhan video hien co, KHONG bao lai ca kho video cu
const MAX_PER_RUN = 2;

function parseFeed(xml) {
  const videos = [];
  for (const block of xml.split("<entry>").slice(1)) {
    const id = (block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = (block.match(/<title>([^<]*)<\/title>/) || [])[1];
    const published = (block.match(/<published>([^<]+)<\/published>/) || [])[1];
    if (!id || !title) continue;
    videos.push({
      id,
      title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
      published,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    });
  }
  return videos;
}

async function fetchChannelVideos() {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
  if (!res.ok) throw new Error(`Khong doc duoc RSS YouTube: HTTP ${res.status}`);
  return parseFeed(await res.text());
}

// Thumbnail chat luong cao khong phai video nao cung co -> kiem tra truoc, thieu
// thi lui ve ban thuong (hqdefault) de khong bao gio gui thieu anh.
async function pickThumbnail(video) {
  try {
    const res = await fetch(video.thumbnail, { method: "HEAD" });
    if (res.ok) return video.thumbnail;
  } catch (e) {
    // roi xuong ban du phong
  }
  return `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}

async function writeIntro(video) {
  // Kenh Telegram nay LA kenh cua chinh anh Phong, nen bai viet phai la anh Phong
  // dang noi voi cong dong cua minh — xung "minh", goi nguoi doc la "ban".
  // TUYET DOI khong viet kieu nguoi thu ba gioi thieu ve "anh Phong Menly".
  const system =
    `Bạn đang viết với tư cách CHÍNH Phong Menly — KOL về ứng dụng AI thực chiến, affiliate AI và xây hệ thống tự động — đăng lên kênh Telegram cộng đồng của chính mình.\n` +
    `Nhiệm vụ: viết đoạn giới thiệu ngắn cho video YouTube mới mình vừa đăng.\n` +
    `Yêu cầu về giọng — QUAN TRỌNG NHẤT:\n` +
    `- Ngôi thứ nhất: xưng "mình", gọi người đọc là "bạn" (hoặc "anh em" nếu hợp ngữ cảnh)\n` +
    `- TUYỆT ĐỐI KHÔNG nhắc tới "anh Phong", "Phong Menly", "trợ lý", "Uyên Nhi" — không có người thứ ba nào ở đây, chính mình đang nói\n` +
    `- Viết "mình sẽ hướng dẫn bạn", KHÔNG viết "anh Phong sẽ hướng dẫn bạn"\n` +
    `Yêu cầu về nội dung:\n` +
    `- Tiếng Việt có dấu đầy đủ, thân thiện, thực chiến, không sáo rỗng\n` +
    `- Câu đầu là một hook nêu đúng điều người xem nhận được\n` +
    `- Sau đó 2-3 gạch đầu dòng ngắn nói rõ video giúp được gì\n` +
    `- Kết bằng 1 câu mời xem tự nhiên\n` +
    `- Tối đa 500 ký tự, không markdown, không dùng dấu * hoặc **, không chèn link\n` +
    `- Chỉ dựa vào tiêu đề video, TUYỆT ĐỐI không bịa số liệu hay chi tiết không có trong tiêu đề`;

  return chatComplete({
    system,
    messages: [{ role: "user", content: `Tiêu đề video: ${video.title}` }],
    maxTokens: 400,
    temperature: 0.7,
  });
}

// Gui 1 video len kenh: Nhi viet gioi thieu -> gui kem thumbnail + link
async function sendVideoToChannel(video) {
  const intro = await writeIntro(video);
  const caption = `${intro.trim()}\n\n${video.url}`.slice(0, 1020);
  await sendPhotoToChannel(await pickThumbnail(video), caption);
  return { title: video.title, url: video.url, caption };
}

// Gui thu 1 video cu the (dung de test, hoac khi muon dang lai video cu).
// videoId de trong -> lay video moi nhat tren kenh.
async function sendVideoById(videoId) {
  const videos = await fetchChannelVideos();
  const video = videoId ? videos.find((v) => v.id === videoId) : videos[0];
  if (!video) throw new Error(`Khong tim thay video ${videoId} tren kenh`);
  return sendVideoToChannel(video);
}

// Dat lai moc: tinh tu THOI DIEM NAY tro di. Moi video da co tren kenh deu duoc
// coi la cu, chi video dang SAU thoi diem nay moi duoc gui len kenh.
async function resetBaseline() {
  const videos = await fetchChannelVideos();
  const since = Date.now();
  await db.setKv(STATE_KEY, { ids: videos.map((v) => v.id), since });
  return {
    baselineVideos: videos.length,
    since: new Date(since).toISOString(),
    newestKnown: videos[0] ? videos[0].title : null,
  };
}

async function checkNewVideos() {
  const videos = await fetchChannelVideos();
  if (!videos.length) return { checked: 0, sent: 0, reason: "RSS khong co video" };

  const state = await db.getKv(STATE_KEY);

  // Lan dau chay: ghi nhan moc, khong gui gi ca
  if (!state) {
    const info = await resetBaseline();
    return { checked: videos.length, sent: 0, reason: "Lan dau chay — da ghi nhan moc, chua gui", ...info };
  }

  const known = new Set(state.ids || []);
  // Hai lop chan de tuyet doi khong dang lai video cu:
  //   1. Da nam trong danh sach mốc -> bo qua
  //   2. Dang TRUOC thoi diem dat moc -> bo qua (bat duoc ca truong hop video cu
  //      bat ngo quay lai RSS, vd anh Phong doi video an thanh cong khai)
  const since = Number(state.since) || 0;
  const fresh = videos
    .filter((v) => !known.has(v.id))
    .filter((v) => !since || new Date(v.published).getTime() > since)
    .slice(0, MAX_PER_RUN);

  if (!fresh.length) {
    // Video cu lot vao nhung bi chan boi moc thoi gian -> ghi nhan luon cho lan sau
    const stale = videos.filter((v) => !known.has(v.id));
    if (stale.length) {
      stale.forEach((v) => known.add(v.id));
      await db.setKv(STATE_KEY, { ids: [...known].slice(-50), since });
    }
    return { checked: videos.length, sent: 0, reason: "Khong co video moi" };
  }

  const sent = [];
  for (const video of fresh) {
    try {
      await sendVideoToChannel(video);
      sent.push(video.title);
      known.add(video.id);
    } catch (err) {
      // Gui that bai thi KHONG danh dau da gui — de lan sau thu lai
      console.error("[youtube-watch] Loi khi gui video:", video.id, err.message);
    }
  }

  // Chi giu 50 id gan nhat, du de nhan dien video moi ma khong phinh du lieu
  await db.setKv(STATE_KEY, { ids: [...known].slice(-50), since });
  return { checked: videos.length, sent: sent.length, titles: sent };
}

module.exports = { checkNewVideos, fetchChannelVideos, sendVideoById, sendVideoToChannel, resetBaseline };

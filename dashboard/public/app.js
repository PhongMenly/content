// ===== Toast thong bao + thanh tien trinh (dung chung moi trang) =====
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Thanh tien trinh gia lap: chay dan len ~90% roi dung o do cho den khi goi finishProgressBar
function startProgressBar(wrapEl) {
  if (!wrapEl) return null;
  wrapEl.classList.add("active");
  const fill = wrapEl.querySelector(".progress-bar-fill");
  let pct = 0;
  if (fill) fill.style.width = "0%";
  const interval = setInterval(() => {
    pct += (90 - pct) * 0.06;
    if (fill) fill.style.width = Math.min(pct, 90) + "%";
  }, 400);
  return interval;
}

function finishProgressBar(wrapEl, interval) {
  if (interval) clearInterval(interval);
  if (!wrapEl) return;
  const fill = wrapEl.querySelector(".progress-bar-fill");
  if (fill) fill.style.width = "100%";
  setTimeout(() => {
    wrapEl.classList.remove("active");
    if (fill) fill.style.width = "0%";
  }, 500);
}

async function loadCreditWidget() {
  try {
    const res = await fetch("/api/credits/latest");
    const data = await res.json();
    const widget = document.getElementById("credit-widget");
    if (widget && data.topview) {
      widget.textContent = `Topview: ${data.topview.balance} credit`;
    }
  } catch (e) {
    // Silent fail — widget just stays as placeholder
  }
}

function statusLabel(status) {
  const labels = {
    draft: "Bản nháp",
    ready_for_review: "Chờ duyệt",
    approved: "Đã duyệt",
    scheduled: "Đã lên lịch",
    posted: "Đã đăng",
    failed: "Lỗi",
    archived: "Lưu trữ",
    idea: "Ý tưởng",
  };
  return labels[status] || status;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function formatRelativeTime(unixSeconds) {
  if (!unixSeconds) return "";
  const diffMin = Math.floor((Date.now() / 1000 - unixSeconds) / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} giờ trước`;
  return `${Math.floor(diffMin / 1440)} ngày trước`;
}

function formatDateTime(unixSeconds) {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${hh}:${mi} ngày ${dd}/${mm}`;
}

let fbPageName = "Facebook Page";
async function loadFbPageName() {
  try {
    const res = await fetch("/api/settings/facebook-page-name");
    const data = await res.json();
    if (data.name) fbPageName = data.name;
  } catch (err) {
    // giu ten mac dinh neu loi
  }
}
function fbPageInitials() {
  return fbPageName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function renderPostCard(p) {
  const bodyText = (p.body || "").replace(/^#.*\n+/, "").slice(0, 220);
  const isPosted = p.status === "posted";
  const dateLine = isPosted
    ? `Đã đăng ${formatDate(p.posted_at || p.created_at)}`
    : formatRelativeTime(p.created_at);
  const footer = isPosted
    ? `
      ${p.fb_reach ? `<span>&#128065; ${p.fb_reach}</span>` : ""}
      <span>&#128077; ${p.fb_likes || 0}</span>
      <span class="fb-action" onclick="event.stopPropagation(); openPostView(${p.id}, true)">&#128172; ${p.fb_comments || 0}</span>
      <span>&#8635; ${p.fb_shares || 0}</span>
    `
    : `
      <span>&#128077; Thích</span>
      <span>&#128172; Bình luận</span>
      <span>&#8635; Chia sẻ</span>
    `;
  const imageArea = p.image_path
    ? `<img class="fb-image" src="${p.image_path}" alt="Ảnh bài viết" loading="lazy" />`
    : `<div class="fb-image fb-image-empty">
         <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
         Chưa có ảnh
       </div>`;
  const scheduleLine = p.status === "scheduled" && p.scheduled_time
    ? `<div class="fb-schedule-line">Sẽ đăng lúc ${formatDateTime(p.scheduled_time)}</div>`
    : "";
  return `
    <div class="post-card" onclick="openPostView(${p.id})">
      <div class="post-card-badges">
        ${p.posted_number ? `<span class="posted-number-badge">#${p.posted_number}</span>` : ""}
        <span class="status-badge status-${p.status}">${statusLabel(p.status)}</span>
        <button class="card-delete-btn" title="Xóa bài" onclick="deletePostFromCard(event, ${p.id})">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="fb-header">
        <div class="fb-avatar">${fbPageInitials()}</div>
        <div>
          <div class="fb-page-name">${fbPageName}</div>
          <div class="fb-subtext">${p.platform || "Facebook"} · ${dateLine}</div>
        </div>
      </div>
      <div class="fb-body">${escapeHtml(bodyText)}</div>
      ${imageArea}
      ${scheduleLine}
      <div class="fb-footer">${footer}</div>
      <div class="post-card-meta">
        <span>${p.pillar || "Chưa gắn pillar"}</span>
        <span></span>
      </div>
    </div>
  `;
}

async function deletePostFromCard(event, id) {
  event.stopPropagation();
  if (!confirm("Xóa bài này? Bài sẽ bị gỡ khỏi lịch đăng và không khôi phục được.")) return;
  const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert("Lỗi xóa bài: " + (err.error || res.status));
    return;
  }
  const activeFilter = document.querySelector(".filter-btn.active");
  loadPostList(activeFilter ? activeFilter.dataset.status : "");
}

// ===== Tu khoa dinh huong y tuong (tab Y tuong) =====
function initIdeaToolbox() {
  const toolbox = document.getElementById("idea-toolbox");
  if (!toolbox) return;
  const input = document.getElementById("idea-keywords");
  const note = document.getElementById("idea-toolbox-note");

  fetch("/api/settings/topic-keywords")
    .then((r) => r.json())
    .then((data) => { input.value = (data.keywords || []).join(", "); })
    .catch(() => {});

  document.getElementById("save-keywords-btn").addEventListener("click", async () => {
    const keywords = input.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const res = await fetch("/api/settings/topic-keywords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords }),
    });
    const data = await res.json();
    note.textContent = res.ok
      ? (data.saved > 0 ? `Đã lưu ${data.saved} từ khóa — AI sẽ bám theo khi đề xuất.` : "Đã xóa từ khóa — AI chuyển về chế độ tự chủ động.")
      : "Lỗi lưu từ khóa";
  });

  document.getElementById("generate-ideas-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "AI đang tìm chủ đề...";
    note.textContent = "Thường mất 15-30 giây, danh sách cũng được gửi qua Telegram.";
    try {
      // Tu dong luu tu khoa dang go trong o truoc khi chay, khoi can bam Luu rieng
      const keywords = input.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      await fetch("/api/settings/topic-keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      const res = await fetch("/api/settings/generate-topics", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        note.textContent = `Đã tạo ${data.proposed} ý tưởng mới.`;
        loadPostList("idea");
      } else {
        note.textContent = "Lỗi: " + (data.error || res.status);
      }
    } catch (err) {
      note.textContent = "Lỗi kết nối: " + err.message;
    }
    btn.disabled = false;
    btn.textContent = "Đề xuất chủ đề ngay";
  });
}

function initRefChannel() {
  const input = document.getElementById("ref-channel-input");
  if (!input) return;
  const note = document.getElementById("ref-channel-note");
  const result = document.getElementById("ref-channel-result");

  fetch("/api/settings/reference-channel")
    .then((r) => r.json())
    .then((data) => {
      if (data && data.url) {
        input.value = data.url;
        const top = (data.videos || []).slice(0, 3).map((v) => `"${v.title}"`).join(", ");
        result.textContent = `Đang học kênh: ${data.channelTitle} — top video: ${top}`;
      }
    })
    .catch(() => {});

  document.getElementById("analyze-channel-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const url = input.value.trim();
    if (!url) { note.textContent = "Dán link kênh trước đã."; return; }
    btn.disabled = true;
    btn.textContent = "Đang phân tích...";
    note.textContent = "";
    try {
      const res = await fetch("/api/settings/reference-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok) {
        note.textContent = `Đã phân tích ${data.videoCount} video của kênh "${data.channelTitle}".`;
        result.innerHTML = "Top video ăn khách:<br>" + data.topVideos
          .map((v) => `• ${escapeHtml(v.title)} (${(v.views || 0).toLocaleString("vi-VN")} lượt xem)`)
          .join("<br>");
      } else {
        note.textContent = "Lỗi: " + (data.error || res.status);
      }
    } catch (err) {
      note.textContent = "Lỗi kết nối: " + err.message;
    }
    btn.disabled = false;
    btn.textContent = "Phân tích kênh";
  });
}

// ===== Hop doc bai + quan ly binh luan =====
let pvCurrentPostId = null;
let pvReplyTo = null; // { id, name } khi dang tra loi 1 binh luan

async function openPostView(id, focusComments = false) {
  const dlg = document.getElementById("post-view-dialog");
  if (!dlg) {
    window.location.href = `/posts/${id}`;
    return;
  }
  pvCurrentPostId = id;
  pvReplyTo = null;

  const res = await fetch(`/api/posts/${id}`);
  if (!res.ok) return;
  const post = await res.json();

  document.getElementById("pv-title").textContent = post.title || post.slug || "";
  const statusEl = document.getElementById("pv-status");
  statusEl.textContent = statusLabel(post.status);
  statusEl.className = `status-badge status-${post.status}`;

  const scheduleEl = document.getElementById("pv-schedule");
  scheduleEl.textContent =
    post.status === "scheduled" && post.scheduled_time
      ? `Sẽ đăng lúc ${formatDateTime(post.scheduled_time)}`
      : "";

  const imgEl = document.getElementById("pv-image");
  if (post.image_path) {
    imgEl.src = post.image_path;
    imgEl.style.display = "block";
  } else {
    imgEl.style.display = "none";
  }

  document.getElementById("pv-body").textContent = post.body || "(Bài chưa có nội dung)";

  const isPosted = post.status === "posted";
  const metricsEl = document.getElementById("pv-metrics");
  // Chi hien so lieu khi that su co du lieu tu Facebook (fb_post_id). Bai dang qua
  // Make khong co fb_post_id -> khong dong bo duoc, an di cho khoi hien 0 gia.
  if (isPosted && post.fb_post_id) {
    metricsEl.style.display = "flex";
    metricsEl.innerHTML = `
      ${post.fb_reach ? `<span>&#128065; ${post.fb_reach} tiếp cận</span>` : ""}
      <span>&#128077; ${post.fb_likes || 0} thích</span>
      <span>&#128172; ${post.fb_comments || 0} bình luận</span>
      <span>&#8635; ${post.fb_shares || 0} chia sẻ</span>
    `;
  } else {
    metricsEl.style.display = "none";
  }

  const editBtn = document.getElementById("pv-edit");
  editBtn.textContent = post.status === "ready_for_review" ? "Chỉnh sửa & duyệt" : "Chỉnh sửa";
  editBtn.onclick = () => { window.location.href = `/posts/${id}`; };

  const commentsBtn = document.getElementById("pv-comments-btn");
  const commentsSection = document.getElementById("pv-comments-section");
  if (isPosted && post.fb_post_id) {
    commentsBtn.style.display = "inline-block";
    commentsBtn.onclick = () => {
      commentsSection.style.display = "block";
      commentsBtn.style.display = "none";
      loadPvComments();
      commentsSection.scrollIntoView({ behavior: "smooth" });
    };
    if (focusComments) {
      commentsSection.style.display = "block";
      commentsBtn.style.display = "none";
      loadPvComments();
    } else {
      commentsSection.style.display = "none";
    }
  } else {
    commentsBtn.style.display = "none";
    commentsSection.style.display = "none";
  }

  dlg.showModal();
  if (focusComments) {
    setTimeout(() => commentsSection.scrollIntoView({ behavior: "smooth" }), 150);
  }
}

async function loadPvComments() {
  const listEl = document.getElementById("pv-comments-list");
  listEl.textContent = "Đang tải bình luận...";
  const res = await fetch(`/api/posts/${pvCurrentPostId}/comments`);
  const data = await res.json();
  if (!res.ok) {
    listEl.textContent = "Không tải được bình luận: " + (data.error || res.status);
    return;
  }
  if (data.length === 0) {
    listEl.innerHTML = '<div class="pv-comment-empty">Chưa có bình luận nào.</div>';
    return;
  }
  listEl.innerHTML = data
    .map((c) => {
      const name = c.from && c.from.name ? c.from.name : "Người dùng Facebook";
      const time = c.created_time ? new Date(c.created_time).toLocaleString("vi-VN") : "";
      return `
        <div class="pv-comment">
          <div class="pv-comment-head">
            <strong>${escapeHtml(name)}</strong>
            <span>${time}</span>
          </div>
          <div class="pv-comment-msg">${escapeHtml(c.message || "")}</div>
          <div class="pv-comment-actions">
            <button onclick="pvSetReply('${c.id}', '${escapeHtml(name).replace(/'/g, "\\'")}')">Trả lời</button>
            <button onclick="pvDeleteComment('${c.id}')">Xóa</button>
            ${c.like_count ? `<span>${c.like_count} thích</span>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function pvSetReply(commentId, name) {
  pvReplyTo = { id: commentId, name };
  const note = document.getElementById("pv-reply-note");
  note.innerHTML = `Đang trả lời <strong>${name}</strong> <button onclick="pvCancelReply()">Hủy</button>`;
  document.getElementById("pv-comment-input").focus();
}

function pvCancelReply() {
  pvReplyTo = null;
  document.getElementById("pv-reply-note").innerHTML = "";
}

async function pvSendComment() {
  const input = document.getElementById("pv-comment-input");
  const message = input.value.trim();
  if (!message) return;
  const sendBtn = document.getElementById("pv-comment-send");
  sendBtn.disabled = true;
  const res = await fetch(`/api/posts/${pvCurrentPostId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, comment_id: pvReplyTo ? pvReplyTo.id : undefined }),
  });
  sendBtn.disabled = false;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert("Không gửi được: " + (err.error || res.status));
    return;
  }
  input.value = "";
  pvCancelReply();
  loadPvComments();
}

async function pvDeleteComment(commentId) {
  if (!confirm("Xóa bình luận này khỏi Facebook?")) return;
  const res = await fetch(`/api/posts/${pvCurrentPostId}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert("Không xóa được: " + (err.error || res.status));
    return;
  }
  loadPvComments();
}

function initPostViewDialog() {
  const dlg = document.getElementById("post-view-dialog");
  if (!dlg) return;
  document.getElementById("pv-close").addEventListener("click", () => dlg.close());
  document.getElementById("pv-comment-send").addEventListener("click", pvSendComment);
  document.getElementById("pv-comment-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") pvSendComment();
  });
  // Bam ra ngoai hop la dong
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
}

async function loadPostList(status) {
  const listEl = document.getElementById("post-list");
  if (!listEl) return;
  const url = status ? `/api/posts?status=${encodeURIComponent(status)}` : "/api/posts";
  const res = await fetch(url);
  let posts = await res.json();

  // Tab "Tat ca" la ban lam viec: khong hien bai da dang (xem o tab "Da dang")
  if (!status) {
    posts = posts.filter((p) => p.status !== "posted");
  }

  if (posts.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><strong>Chưa có bài viết nào ở trạng thái này</strong>Bấm nút "+ Tạo bài mới" phía trên để bắt đầu, hoặc chọn bộ lọc khác.</div>';
    return;
  }

  // Sap xep theo dong thoi gian: bai sap dang som nhat len dau,
  // roi den cho duyet / ban nhap, cuoi cung la bai da dang (moi nhat truoc)
  const statusRank = { scheduled: 0, ready_for_review: 1, draft: 2, failed: 3, posted: 4 };
  posts.sort((a, b) => {
    const ra = statusRank[a.status] !== undefined ? statusRank[a.status] : 2;
    const rb = statusRank[b.status] !== undefined ? statusRank[b.status] : 2;
    if (ra !== rb) return ra - rb;
    if (a.status === "scheduled") return (a.scheduled_time || 0) - (b.scheduled_time || 0);
    if (a.status === "posted") return (b.posted_at || b.created_at) - (a.posted_at || a.created_at);
    return b.updated_at - a.updated_at;
  });

  listEl.innerHTML = posts.map(renderPostCard).join("");
}

async function initPostListPage() {
  const listEl = document.getElementById("post-list");
  if (!listEl) return;

  await loadFbPageName();
  loadPostList("");

  const ideaToolbox = document.getElementById("idea-toolbox");
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadPostList(btn.dataset.status);
      if (ideaToolbox) ideaToolbox.style.display = btn.dataset.status === "idea" ? "flex" : "none";
    });
  });

  initIdeaToolbox();
  initRefChannel();

  const newPostBtn = document.getElementById("new-post-btn");
  const dialog = document.getElementById("new-post-dialog");
  const cancelBtn = document.getElementById("cancel-new-post");
  const form = document.getElementById("new-post-form");

  if (newPostBtn && dialog) {
    newPostBtn.addEventListener("click", () => dialog.showModal());
    cancelBtn.addEventListener("click", () => dialog.close());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const post = await res.json();
        window.location.href = `/posts/${post.id}`;
      } else {
        const err = await res.json();
        alert("Loi: " + err.error);
      }
    });
  }
}

const STEPPER_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "ready_for_review", label: "Cho duyet" },
  { key: "approved", label: "Da duyet" },
  { key: "scheduled", label: "Da len lich" },
  { key: "posted", label: "Da dang" },
];

function renderStepper(currentStatus) {
  if (currentStatus === "failed" || currentStatus === "archived") {
    return `<div class="status-stepper"><div class="stepper-step failed"><div class="stepper-dot">!</div><div class="stepper-label">${statusLabel(currentStatus)}</div></div></div>`;
  }
  const currentIndex = STEPPER_STEPS.findIndex((s) => s.key === currentStatus);
  return `<div class="status-stepper">${STEPPER_STEPS.map((step, i) => {
    const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "";
    const lineState = i < currentIndex ? "done" : "";
    const dot = state === "done" ? "&#10003;" : i + 1;
    const line = i > 0 ? `<div class="stepper-line ${lineState}"></div>` : "";
    return `${line}<div class="stepper-step ${state}"><div class="stepper-dot">${dot}</div><div class="stepper-label">${step.label}</div></div>`;
  }).join("")}</div>`;
}

async function initPostDetailPage() {
  const detailEl = document.querySelector(".post-detail");
  if (!detailEl) return;
  const postId = detailEl.dataset.postId;

  async function loadBrandKeyOptions() {
    const res = await fetch("/api/settings/brand-profiles");
    const profiles = await res.json();
    const select = document.getElementById("meta-brand_key");
    select.innerHTML = `<option value="">(mặc định)</option>` + profiles.map((p) => `<option value="${p.key}">${p.name}</option>`).join("");
  }
  await loadBrandKeyOptions();

  async function reload() {
    const res = await fetch(`/api/posts/${postId}`);
    const post = await res.json();

    document.getElementById("post-title").textContent =
      (post.posted_number ? `#${post.posted_number} — ` : "") + (post.title || post.slug);
    const statusEl = document.getElementById("post-status");
    statusEl.textContent = statusLabel(post.status);
    statusEl.className = `status-badge status-${post.status}`;

    document.getElementById("post-stepper").innerHTML = renderStepper(post.status);

    document.getElementById("meta-platform").value = post.platform || "";
    document.getElementById("meta-pillar").value = post.pillar || "";
    document.getElementById("meta-cta_type").value = post.cta_type || "";
    document.getElementById("meta-brand_key").value = post.brand_key || "";
    document.getElementById("post-body").value = post.body || "";

    const previewEl = document.getElementById("post-image-preview");
    previewEl.innerHTML = post.image_path
      ? `<img src="${post.image_path}" alt="Anh bai viet" />`
      : '<p style="color:#555">Chua co anh</p>';

    const historyEl = document.getElementById("post-history");
    historyEl.innerHTML = post.history
      .map((h) => {
        const date = new Date(h.created_at * 1000).toLocaleString("vi-VN");
        return `<li>${date} — ${h.event_type}${h.note ? ": " + h.note : ""}</li>`;
      })
      .join("");

    const scheduleInfoEl = document.getElementById("schedule-info");
    const cancelBtn = document.getElementById("cancel-schedule-btn");
    if (post.scheduled_time) {
      const d = new Date(post.scheduled_time * 1000);
      const date = d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", weekday: "long", day: "numeric", month: "numeric", year: "numeric" });
      scheduleInfoEl.textContent = `Đã lên lịch đăng lúc: ${date}`;
      cancelBtn.style.display = "inline-block";
      // Do san gia tri hien tai vao o chon ngay gio
      const input = document.getElementById("schedule-input");
      if (input && !input.value) {
        const pad = (n) => String(n).padStart(2, "0");
        input.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    } else {
      scheduleInfoEl.textContent = "";
      cancelBtn.style.display = "none";
    }

    const metricsBox = document.getElementById("post-metrics-box");
    if (post.status === "posted") {
      metricsBox.style.display = "block";
      // Bai dang qua Make khong co fb_post_id -> Facebook khong tra so lieu ve duoc.
      // An cac o so lieu va nut lam moi, chi giu lai ngay dang.
      const hasFbData = Boolean(post.fb_post_id);
      metricsBox.querySelectorAll(".metric").forEach((el) => {
        el.style.display = hasFbData ? "" : "none";
      });
      document.getElementById("sync-metrics-btn").style.display = hasFbData ? "" : "none";
      const reachEl = document.getElementById("metric-reach");
      if (reachEl) reachEl.textContent = (post.fb_reach === null || post.fb_reach === undefined) ? "—" : post.fb_reach;
      document.getElementById("metric-likes").textContent = post.fb_likes || 0;
      document.getElementById("metric-comments").textContent = post.fb_comments || 0;
      document.getElementById("metric-shares").textContent = post.fb_shares || 0;
      document.getElementById("metric-posted-date").textContent = `Da dang ${formatDate(post.posted_at || post.created_at)}`;
      const updatedNote = document.getElementById("metric-updated-note");
      updatedNote.textContent = !hasFbData
        ? "Bai dang qua Make nen Facebook khong tra so lieu ve dashboard"
        : post.metrics_updated_at
          ? `So lieu cap nhat ${formatRelativeTime(post.metrics_updated_at)}`
          : "Chua co so lieu, bam Lam moi de lay tu Facebook";
    } else {
      metricsBox.style.display = "none";
    }
  }

  document.getElementById("save-btn").addEventListener("click", async () => {
    await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: document.getElementById("post-body").value,
        platform: document.getElementById("meta-platform").value,
        pillar: document.getElementById("meta-pillar").value,
        cta_type: document.getElementById("meta-cta_type").value,
        brand_key: document.getElementById("meta-brand_key").value || null,
      }),
    });
    await reload();
  });

  document.getElementById("approve-btn").addEventListener("click", async () => {
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Không duyệt được bài");
      return;
    }
    await reload();
  });

  document.getElementById("schedule-btn").addEventListener("click", async () => {
    const value = document.getElementById("schedule-input").value;
    if (!value) return;
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_time: value, status: "scheduled" }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert("Loi: " + err.error);
      return;
    }
    await reload();
  });

  document.getElementById("image-input").addEventListener("change", async () => {
    const fileInput = document.getElementById("image-input");
    if (!fileInput.files[0]) return;
    const formData = new FormData();
    formData.append("image", fileInput.files[0]);
    const res = await fetch(`/api/posts/${postId}/image`, { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json();
      alert("Loi tai anh: " + err.error);
      return;
    }
    await reload();
  });

  document.getElementById("cancel-schedule-btn").addEventListener("click", async () => {
    await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancel_schedule" }),
    });
    await reload();
  });

  document.getElementById("delete-post-btn").addEventListener("click", async () => {
    if (!confirm("Xóa bài này? Bài sẽ bị gỡ khỏi lịch đăng và không khôi phục được.")) return;
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("Lỗi xóa bài: " + (err.error || res.status));
      return;
    }
    window.location.href = "/";
  });

  document.getElementById("sync-metrics-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Dang lam moi...";
    try {
      const res = await fetch(`/api/posts/${postId}/sync-metrics`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        alert("Loi: " + err.error);
      }
      await reload();
    } finally {
      btn.disabled = false;
      btn.textContent = "Lam moi so lieu tu Facebook";
    }
  });

  const libraryDialog = document.getElementById("library-dialog");
  document.getElementById("open-library-btn").addEventListener("click", async () => {
    const res = await fetch("/api/library");
    const images = await res.json();
    const gridEl = document.getElementById("library-grid");
    if (images.length === 0) {
      gridEl.innerHTML = '<p style="color:#555">Kho anh dang trong.</p>';
    } else {
      gridEl.innerHTML = images
        .map((img) => `<img src="${img.url}" data-url="${img.url}" alt="${img.file_name}" />`)
        .join("");
      gridEl.querySelectorAll("img").forEach((imgEl) => {
        imgEl.addEventListener("click", async () => {
          await fetch(`/api/posts/${postId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_path: imgEl.dataset.url }),
          });
          libraryDialog.close();
          await reload();
        });
      });
    }
    libraryDialog.showModal();
  });
  document.getElementById("close-library-btn").addEventListener("click", () => libraryDialog.close());

  await reload();
}

function renderStatsRow(p, index) {
  return `
    <tr onclick="window.location.href='/posts/${p.id}'" style="cursor:pointer">
      <td>${index + 1}</td>
      <td class="stats-title-cell">${escapeHtml(p.title || p.slug)}</td>
      <td>${p.pillar || "-"}</td>
      <td>${formatDate(p.posted_at)}</td>
      <td>${p.reach === null ? "—" : p.reach}</td>
      <td>${p.likes}</td>
      <td>${p.comments}</td>
      <td>${p.shares}</td>
      <td><strong>${p.total_engagement}</strong></td>
    </tr>
  `;
}

async function loadStats() {
  const tbody = document.getElementById("stats-tbody");
  const summaryEl = document.getElementById("stats-summary");
  if (!tbody) return;

  const res = await fetch("/api/stats");
  const data = await res.json();

  if (data.count === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:#555">Chua co bai viet nao da dang.</td></tr>';
    summaryEl.innerHTML = "";
    return;
  }

  summaryEl.innerHTML = `
    <div class="stats-summary-card"><span>${data.count}</span>Bài đã đăng</div>
    <div class="stats-summary-card" title="Facebook đã ngừng cung cấp reach cấp bài viết qua API"><span>${data.summary.reach === null ? "—" : data.summary.reach}</span>Tổng tiếp cận</div>
    <div class="stats-summary-card"><span>${data.summary.likes}</span>Tổng lượt thích</div>
    <div class="stats-summary-card"><span>${data.summary.comments}</span>Tổng bình luận</div>
    <div class="stats-summary-card"><span>${data.summary.shares}</span>Tổng chia sẻ</div>
  `;

  tbody.innerHTML = data.posts.map(renderStatsRow).join("");
}

function initStatsPage() {
  const tbody = document.getElementById("stats-tbody");
  if (!tbody) return;

  loadStats();

  const refreshBtn = document.getElementById("refresh-stats-btn");
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Dang lam moi...";
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      for (const p of data.posts) {
        await fetch(`/api/posts/${p.id}/sync-metrics`, { method: "POST" });
      }
      await loadStats();
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Lam moi so lieu";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadCreditWidget();
  initPostListPage();
  initPostViewDialog();
  initPostDetailPage();
  initStatsPage();
});

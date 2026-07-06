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
      <span>&#128077; ${p.fb_likes || 0}</span>
      <span>&#128172; ${p.fb_comments || 0}</span>
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
    <div class="post-card" onclick="window.location.href='/posts/${p.id}'">
      <div class="post-card-badges">
        ${p.posted_number ? `<span class="posted-number-badge">#${p.posted_number}</span>` : ""}
        <span class="status-badge status-${p.status}">${statusLabel(p.status)}</span>
        <button class="card-delete-btn" title="Xóa bài" onclick="deletePostFromCard(event, ${p.id})">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="fb-header">
        <div class="fb-avatar">PM</div>
        <div>
          <div class="fb-page-name">Phong Menly TP</div>
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

async function loadPostList(status) {
  const listEl = document.getElementById("post-list");
  if (!listEl) return;
  const url = status ? `/api/posts?status=${encodeURIComponent(status)}` : "/api/posts";
  const res = await fetch(url);
  const posts = await res.json();

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

function initPostListPage() {
  const listEl = document.getElementById("post-list");
  if (!listEl) return;

  loadPostList("");

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadPostList(btn.dataset.status);
    });
  });

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
      document.getElementById("metric-likes").textContent = post.fb_likes || 0;
      document.getElementById("metric-comments").textContent = post.fb_comments || 0;
      document.getElementById("metric-shares").textContent = post.fb_shares || 0;
      document.getElementById("metric-posted-date").textContent = `Da dang ${formatDate(post.posted_at || post.created_at)}`;
      const updatedNote = document.getElementById("metric-updated-note");
      updatedNote.textContent = post.metrics_updated_at
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
      }),
    });
    await reload();
  });

  document.getElementById("approve-btn").addEventListener("click", async () => {
    await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
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

  document.getElementById("share-groups-btn").addEventListener("click", async (e) => {
    if (!confirm("Chia sẻ bài này lên các nhóm đã cấu hình? Quá trình chạy nền vài phút (giữ nhịp chậm như người thật để an toàn tài khoản).")) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Đang chia sẻ...";
    const infoEl = document.getElementById("share-groups-info");
    try {
      const res = await fetch(`/api/posts/${postId}/share-groups`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        infoEl.textContent = "Không chia sẻ được: " + (data.error || res.status);
      } else {
        infoEl.textContent = data.message || "Đã bắt đầu chia sẻ nền. Kết quả sẽ ghi vào nhật ký.";
      }
    } catch (err) {
      infoEl.textContent = "Lỗi kết nối: " + err.message;
    }
    btn.disabled = false;
    btn.textContent = "Chia sẻ lên nhóm";
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
    <div class="stats-summary-card"><span>${data.count}</span>Bai da dang</div>
    <div class="stats-summary-card"><span>${data.summary.likes}</span>Tong luot thich</div>
    <div class="stats-summary-card"><span>${data.summary.comments}</span>Tong binh luan</div>
    <div class="stats-summary-card"><span>${data.summary.shares}</span>Tong chia se</div>
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
  initPostDetailPage();
  initStatsPage();
});

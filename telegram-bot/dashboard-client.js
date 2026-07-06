const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || "https://phong-menly-dashboard.vercel.app";
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN;

async function apiFetch(path, options = {}) {
  const res = await fetch(`${DASHBOARD_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DASHBOARD_API_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Dashboard API error ${res.status}`);
  }
  return res.json();
}

function listPostsByStatus(status) {
  return apiFetch(`/api/posts?status=${encodeURIComponent(status)}`);
}

function getPost(id) {
  return apiFetch(`/api/posts/${id}`);
}

function patchPost(id, body) {
  return apiFetch(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

module.exports = { listPostsByStatus, getPost, patchPost };

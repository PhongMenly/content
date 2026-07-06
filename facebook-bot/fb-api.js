const fs = require("fs");
const path = require("path");

const GRAPH_API_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function exchangeLongLivedUserToken({ shortLivedToken, appId, appSecret }) {
  const url = `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return data.access_token;
}

async function getPageAccessToken({ longLivedUserToken, pageId }) {
  const url = `${GRAPH_URL}/me/accounts?access_token=${longLivedUserToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  const page = (data.data || []).find((p) => p.id === pageId);
  if (!page) {
    throw new Error(`Khong tim thay Page ${pageId} trong danh sach Page ban quan ly`);
  }
  return page.access_token;
}

async function postText({ pageId, pageAccessToken, message, scheduledTime }) {
  const params = new URLSearchParams({ message, access_token: pageAccessToken });
  if (scheduledTime) {
    params.set("published", "false");
    params.set("scheduled_publish_time", String(scheduledTime));
  }
  const res = await fetch(`${GRAPH_URL}/${pageId}/feed`, { method: "POST", body: params });
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return data;
}

async function postPhoto({ pageId, pageAccessToken, message, imagePath, scheduledTime }) {
  const form = new FormData();
  form.append("caption", message);
  form.append("access_token", pageAccessToken);
  if (scheduledTime) {
    form.append("published", "false");
    form.append("scheduled_publish_time", String(scheduledTime));
  }
  const fileBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([fileBuffer]);
  form.append("source", blob, path.basename(imagePath));

  const res = await fetch(`${GRAPH_URL}/${pageId}/photos`, { method: "POST", body: form });
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return data;
}

module.exports = {
  exchangeLongLivedUserToken,
  getPageAccessToken,
  postText,
  postPhoto,
};

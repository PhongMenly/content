const GRAPH_URL = "https://graph.facebook.com/v21.0";

async function postText({ message }) {
  const pageId = process.env.FB_PAGE_ID;
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const params = new URLSearchParams({ message, access_token: pageAccessToken });
  const res = await fetch(`${GRAPH_URL}/${pageId}/feed`, { method: "POST", body: params });
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return data;
}

async function postPhoto({ message, imageUrl }) {
  const pageId = process.env.FB_PAGE_ID;
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const params = new URLSearchParams({ caption: message, url: imageUrl, access_token: pageAccessToken });
  const res = await fetch(`${GRAPH_URL}/${pageId}/photos`, { method: "POST", body: params });
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return data;
}

async function getPostInsights(fbPostId) {
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const fields = "likes.summary(true).limit(0),comments.summary(true).limit(0),shares";
  const url = `${GRAPH_URL}/${fbPostId}?fields=${fields}&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return {
    likes: (data.likes && data.likes.summary && data.likes.summary.total_count) || 0,
    comments: (data.comments && data.comments.summary && data.comments.summary.total_count) || 0,
    shares: (data.shares && data.shares.count) || 0,
  };
}

module.exports = { postText, postPhoto, getPostInsights };

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

// Dang bang /photos thi Facebook tra ve ID cua tam ANH, khong phai ID bai viet.
// ID bai viet dang {pageId}_{postId} (co dau gach duoi). Neu la photo id -> tra cuu page_story_id.
async function resolvePostId(fbPostId, token) {
  if (String(fbPostId).includes("_")) return fbPostId;
  const res = await fetch(`${GRAPH_URL}/${fbPostId}?fields=page_story_id&access_token=${token}`);
  const data = await res.json();
  if (data.page_story_id) return data.page_story_id;
  return fbPostId;
}

async function getPostInsights(fbPostId) {
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const postId = await resolvePostId(fbPostId, pageAccessToken);

  const fields = "likes.summary(true).limit(0),comments.summary(true).limit(0),shares";
  const url = `${GRAPH_URL}/${postId}?fields=${fields}&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);

  // Luot tiep can (reach): Meta da go post_impressions_unique/post_impressions khoi API
  // cho Page tu cuoi 2025. Van thu lan luot cac ten metric — neu Meta mo lai thi tu co so.
  let reach = 0;
  for (const metric of ["post_impressions_unique", "post_impressions", "views"]) {
    try {
      const ir = await fetch(`${GRAPH_URL}/${postId}/insights?metric=${metric}&access_token=${pageAccessToken}`);
      const idata = await ir.json();
      const values = idata.data && idata.data[0] && idata.data[0].values;
      if (values && values[0] && values[0].value) {
        reach = values[0].value;
        break;
      }
    } catch (e) {
      // thu metric tiep theo
    }
  }

  return {
    likes: (data.likes && data.likes.summary && data.likes.summary.total_count) || 0,
    comments: (data.comments && data.comments.summary && data.comments.summary.total_count) || 0,
    shares: (data.shares && data.shares.count) || 0,
    reach,
    resolvedPostId: postId,
  };
}

module.exports = { postText, postPhoto, getPostInsights };

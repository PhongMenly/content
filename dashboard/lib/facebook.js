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

  // Luot tiep can (reach): Meta da go het cac metric reach/impressions cap bai viet
  // khoi Graph API (da xac nhan qua test truc tiep: post_impressions_unique,
  // post_impressions, post_reach, post_engaged_users deu tra loi "invalid insights
  // metric" — khong phai loi quyen truy cap). De null (khong phai 0) de UI hien
  // "khong co du lieu" thay vi hien thi sai la "0 luot tiep can".
  // Van thu lai — neu Meta mo lai metric nao thi tu dong co so lieu.
  let reach = null;
  for (const metric of ["post_impressions_unique", "post_impressions", "post_reach"]) {
    try {
      const ir = await fetch(`${GRAPH_URL}/${postId}/insights?metric=${metric}&access_token=${pageAccessToken}`);
      const idata = await ir.json();
      const values = idata.data && idata.data[0] && idata.data[0].values;
      if (values && values[0] && values[0].value !== undefined) {
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

// ===== Quan ly binh luan =====

async function getPostComments(fbPostId) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const fields = "id,message,from{name,id},created_time,like_count,comment_count";
  const url = `${GRAPH_URL}/${fbPostId}/comments?fields=${fields}&order=reverse_chronological&limit=50&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return data.data || [];
}

// targetId = fb_post_id (binh luan vao bai) hoac comment_id (tra loi binh luan)
async function createComment(targetId, message) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const params = new URLSearchParams({ message, access_token: token });
  const res = await fetch(`${GRAPH_URL}/${targetId}/comments`, { method: "POST", body: params });
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return data;
}

async function deleteComment(commentId) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const res = await fetch(`${GRAPH_URL}/${commentId}?access_token=${token}`, { method: "DELETE" });
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);
  return data;
}

// ===== Doc bai viet cua chinh Page (dung lam ho so thuong hieu) =====
// Chi doc duoc Page dang quan ly (co FB_PAGE_ACCESS_TOKEN), khong doc duoc Page/profile nguoi khac.
async function getPageTopPosts(limit = 25) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const fields = "id,message,created_time,likes.summary(true).limit(0),comments.summary(true).limit(0),shares";
  const url = `${GRAPH_URL}/${pageId}/posts?fields=${fields}&limit=${limit}&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API error: ${data.error.message}`);

  const posts = (data.data || [])
    .filter((p) => p.message)
    .map((p) => {
      const likes = (p.likes && p.likes.summary && p.likes.summary.total_count) || 0;
      const comments = (p.comments && p.comments.summary && p.comments.summary.total_count) || 0;
      const shares = (p.shares && p.shares.count) || 0;
      return {
        id: p.id,
        message: p.message,
        createdTime: p.created_time,
        engagement: likes + comments + shares,
      };
    })
    .sort((a, b) => b.engagement - a.engagement);

  return posts;
}

module.exports = { postText, postPhoto, getPostInsights, getPostComments, createComment, deleteComment, getPageTopPosts };

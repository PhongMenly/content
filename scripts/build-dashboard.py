import os
import glob
import re

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(BASE_DIR, 'posts')
OUTPUTS_DIR = os.path.join(BASE_DIR, 'outputs')
DASHBOARD_HTML = os.path.join(OUTPUTS_DIR, 'dashboard.html')

def parse_post(filepath):
    filename = os.path.basename(filepath)
    match = re.match(r'^(\d{3,})-(.+)\.md$', filename)
    post_id = match.group(1) if match else "000"
    
    title = "Chưa có tiêu đề"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Extract title
    title_match = re.search(r'title:\s*(.+)', content)
    if title_match:
        title = title_match.group(1).strip()
    else:
        h1_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if h1_match:
            title = h1_match.group(1).strip()
        elif match:
            title = match.group(2).replace('-', ' ').title()
            
    # Try to find an image url
    image_url = ""
    img_match = re.search(r'!\[.*?\]\((.*?)\)', content)
    if img_match:
        image_url = img_match.group(1)

    # Clean content (Remove frontmatter and image markdown)
    lines = content.split('\n')
    clean_lines = []
    in_frontmatter = False
    for line in lines:
        if line.strip() == '---':
            # Toggle frontmatter state
            if not in_frontmatter and len(clean_lines) == 0:
                in_frontmatter = True
                continue
            elif in_frontmatter:
                in_frontmatter = False
                continue
                
        if in_frontmatter:
            continue
            
        # Remove image syntax from text body so it doesn't duplicate
        line = re.sub(r'!\[.*?\]\(.*?\)', '', line)
        clean_lines.append(line)
        
    # Remove excessive empty lines at start
    while clean_lines and not clean_lines[0].strip():
        clean_lines.pop(0)
        
    full_text = "\n".join(clean_lines).strip()
    
    # Guess format
    format_type = "Bài viết"
    if "tiktok" in filename.lower():
        format_type = "Video ngắn"
    elif "facebook" in filename.lower() or "post" in filename.lower():
        format_type = "Ảnh cá nhân"

    return {
        'id': post_id,
        'title': title,
        'text': full_text,
        'image': image_url,
        'filename': filename,
        'format': format_type
    }

def main():
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    post_files = glob.glob(os.path.join(POSTS_DIR, '*.md'))
    posts = []
    
    for f in post_files:
        posts.append(parse_post(f))
        
    posts.sort(key=lambda x: x['id'], reverse=True)
    num_posts = len(posts)
    
    # Build HTML Dashboard
    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Content Dashboard</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; background: #e5e7eb; color: #111111; }}
        .header {{ max-width: 1400px; margin: 0 auto 30px auto; display: flex; justify-content: space-between; align-items: center; }}
        h1 {{ margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 30px; max-width: 1400px; margin: 0 auto; }}
        
        .card {{ background: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025); overflow: hidden; display: flex; flex-direction: column; border: 1px solid #f3f4f6; transition: transform 0.2s ease, box-shadow 0.2s ease; }}
        .card:hover {{ transform: translateY(-3px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }}
        
        .card-header {{ padding: 16px 24px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; background: #fafafa; }}
        .post-id {{ font-weight: 700; color: #9ca3af; font-size: 15px; letter-spacing: 1px; }}
        .copy-btn {{ background: white; border: 1px solid #e5e7eb; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.15s; }}
        .copy-btn:hover {{ background: #f9fafb; border-color: #d1d5db; color: #111; }}
        .copy-btn:active {{ transform: scale(0.97); }}
        
        .card-image {{ width: 100%; height: auto; max-height: 280px; object-fit: cover; border-bottom: 1px solid #f3f4f6; }}
        
        .card-body {{ padding: 24px; flex-grow: 1; max-height: 450px; overflow-y: auto; scrollbar-width: thin; }}
        .card-body::-webkit-scrollbar {{ width: 6px; }}
        .card-body::-webkit-scrollbar-track {{ background: transparent; }}
        .card-body::-webkit-scrollbar-thumb {{ background-color: #d1d5db; border-radius: 10px; }}
        
        .card-title {{ margin: 0 0 16px 0; font-size: 20px; font-weight: 700; line-height: 1.4; color: #111827; }}
        .card-text {{ color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0; white-space: pre-wrap; font-family: inherit; }}
        
        @media (max-width: 768px) {{ .grid {{ grid-template-columns: 1fr; }} }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Content Dashboard</h1>
        <p style="font-weight: 500; color: #6b7280; font-size: 15px;">Tổng số: <span style="color: #111; font-weight: 700;">{num_posts} bài viết</span></p>
    </div>
    <div class="grid">
"""
    for p in posts:
        # Prepare text for clipboard
        safe_copy = p['text'].replace('\\', '\\\\').replace('`', '\\`').replace('$', '\\$')
        
        img_html = f'<img class="card-image" src="{p["image"]}" alt="{p["title"]}">' if p['image'] else ''
        
        html_content += f"""
        <div class="card">
            <div class="card-header">
                <span class="post-id">#{p['id']}</span>
                <button class="copy-btn" onclick="navigator.clipboard.writeText(`{safe_copy}`); const btn=this; const originalText=btn.innerHTML; btn.innerHTML='<span style=\\'color:#10b981;\\'>✓ Copied!</span>'; setTimeout(()=>btn.innerHTML=originalText, 2000);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy
                </button>
            </div>
            {img_html}
            <div class="card-body">
                <h2 class="card-title">{p['title']}</h2>
                <div class="card-text">{p['text']}</div>
            </div>
        </div>
        """

    html_content += """
    </div>
</body>
</html>"""

    with open(DASHBOARD_HTML, 'w', encoding='utf-8') as f:
        f.write(html_content)

if __name__ == '__main__':
    main()

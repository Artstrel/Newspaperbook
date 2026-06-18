import os
import re
import json

def markdown_to_html(md_text):
    md_text = md_text.replace('\r\n', '\n')
    lines = md_text.splitlines()

    html_blocks = []

    current_block_type = None
    current_block_lines = []

    def replace_inline(text):

        text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)

        text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)

        text = re.sub(r'(?<!\!)\[([^\]]*)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', text)
        return text

    def split_row(row):
        s = row.strip()
        if s.startswith('|'):
            s = s[1:]
        if s.endswith('|'):
            s = s[:-1]
        return [c.strip() for c in s.split('|')]

    def is_table_separator(row):
        s = row.strip()
        if '|' not in s or '-' not in s:
            return False
        cells = split_row(s)
        if not cells:
            return False
        return all(re.fullmatch(r':?-{1,}:?', c) for c in cells)

    def render_table(header_line, sep_line, body_lines):
        headers = split_row(header_line)
        seps = split_row(sep_line)
        aligns = []
        for idx in range(len(headers)):
            spec = seps[idx] if idx < len(seps) else '---'
            left, right = spec.startswith(':'), spec.endswith(':')
            if left and right:
                aligns.append('center')
            elif right:
                aligns.append('right')
            else:
                aligns.append(None)

        def style(idx):
            a = aligns[idx] if idx < len(aligns) else None
            return f' style="text-align:{a}"' if a else ''

        out = ['<table class="article-table">', '<thead>']
        out.append('<tr>' + ''.join(
            f'<th{style(idx)}>{replace_inline(h)}</th>' for idx, h in enumerate(headers)
        ) + '</tr>')
        out.append('</thead>')
        out.append('<tbody>')
        for bl in body_lines:
            cells = split_row(bl)
            out.append('<tr>' + ''.join(
                f'<td{style(idx)}>{replace_inline(c)}</td>' for idx, c in enumerate(cells)
            ) + '</tr>')
        out.append('</tbody>')
        out.append('</table>')
        return '<div class="article-table-wrap">\n' + '\n'.join(out) + '\n</div>'

    def flush_block():
        nonlocal current_block_type, current_block_lines
        if not current_block_lines:
            return

        content = "\n".join(current_block_lines).strip()
        if not content:
            current_block_type = None
            current_block_lines = []
            return

        if current_block_type == 'p':
            html_blocks.append(f'<p>{replace_inline(content)}</p>')
        elif current_block_type == 'blockquote':
            bq_lines = []
            cite_html = ""
            for line in current_block_lines:
                line_str = line.strip()
                if line_str.startswith('—') or line_str.startswith('--') or line_str.startswith('cite:'):
                    author = re.sub(r'^(—|--|cite:)\s*', '', line_str).strip()
                    cite_html = f'\n  <cite class="quote-author">{author}</cite>'
                else:
                    bq_lines.append(line)
            bq_content = replace_inline(" ".join(bq_lines))
            html_blocks.append(f'<blockquote class="article-quote">\n  {bq_content}{cite_html}\n</blockquote>')
        elif current_block_type == 'ul':
            list_items = []
            for line in current_block_lines:
                item_text = re.sub(r'^\s*[-*]\s+', '', line).strip()
                list_items.append(f'  <li>{replace_inline(item_text)}</li>')
            html_blocks.append("<ul>\n" + "\n".join(list_items) + "\n</ul>")
        elif current_block_type == 'ol':
            list_items = []
            for line in current_block_lines:
                item_text = re.sub(r'^\s*\d+\.\s+', '', line).strip()
                list_items.append(f'  <li>{replace_inline(item_text)}</li>')
            html_blocks.append("<ol>\n" + "\n".join(list_items) + "\n</ol>")
        elif current_block_type == 'html':
            html_blocks.append(content)

        current_block_type = None
        current_block_lines = []

    n = len(lines)
    i = 0
    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            if current_block_type != 'html':
                flush_block()
            else:
                current_block_lines.append(line)
            i += 1
            continue

        if current_block_type == 'html':
            current_block_lines.append(line)
            if stripped.startswith('</div>') or stripped.startswith('</svg>') or stripped.startswith('</blockquote>'):
                flush_block()
            i += 1
            continue


        if '|' in stripped and (i + 1) < n and is_table_separator(lines[i + 1]):
            flush_block()
            header_line = line
            sep_line = lines[i + 1]
            j = i + 2
            body_lines = []
            while j < n:
                rstr = lines[j].strip()
                if not rstr or '|' not in rstr or rstr.startswith('<!--') or rstr.startswith('<'):
                    break
                body_lines.append(lines[j])
                j += 1
            html_blocks.append(render_table(header_line, sep_line, body_lines))
            i = j
            continue


        if re.fullmatch(r'(-{3,}|\*{3,}|_{3,})', stripped):
            flush_block()
            html_blocks.append('<hr>')
            i += 1
            continue

        is_img_line = stripped.startswith('<img') or stripped.startswith('<svg') or stripped.startswith('<picture')
        if is_img_line and current_block_type in ['ul', 'ol', 'p', 'blockquote']:
            current_block_lines.append(line)
            i += 1
            continue

        if stripped.startswith('#'):
            flush_block()
            h_match = re.match(r'^(#{1,6})\s+(.*)$', stripped)
            if h_match:
                level = len(h_match.group(1))
                h_content = replace_inline(h_match.group(2).strip())
                html_blocks.append(f'<h{level}>{h_content}</h{level}>')
                i += 1
                continue

        if stripped.startswith('>'):
            if current_block_type != 'blockquote':
                flush_block()
            current_block_type = 'blockquote'
            content_line = re.sub(r'^>\s?', '', line)
            current_block_lines.append(content_line)
            i += 1
            continue

        if re.match(r'^\s*[-*]\s+', stripped):
            if current_block_type != 'ul':
                flush_block()
            current_block_type = 'ul'
            current_block_lines.append(line)
            i += 1
            continue

        if re.match(r'^\s*\d+\.\s+', stripped):
            if current_block_type != 'ol':
                flush_block()
            current_block_type = 'ol'
            current_block_lines.append(line)
            i += 1
            continue

        if stripped.startswith('<') and not stripped.startswith('<!') and not (stripped.startswith('<em>') or stripped.startswith('<strong>') or stripped.startswith('<b>') or stripped.startswith('<i>') or stripped.startswith('<a>') or stripped.startswith('<span')):
            flush_block()
            current_block_type = 'html'
            current_block_lines.append(line)
            if stripped.endswith('/>') or (stripped.endswith('>') and (stripped.startswith('<img') or stripped.startswith('<br'))):
                flush_block()
            i += 1
            continue

        if current_block_type not in ['p', None]:
            flush_block()
        current_block_type = 'p'
        current_block_lines.append(line)
        i += 1

    flush_block()
    return "\n\n".join(html_blocks)

def parse_md(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.match(r'^---\r?\n(.*?)\r?\n---\r?\n?(.*)$', content, re.DOTALL)
    if not match:
        return None, content

    frontmatter_str = match.group(1)
    body = match.group(2).strip()

    body = re.sub(r'<span class="image-trigger"[^>]*></span>', '', body)

    def replace_image(m):
        alt = m.group(1)
        url = m.group(2)
        if url.lower().endswith('.svg'):
            if os.path.exists(url):
                with open(url, 'r', encoding='utf-8') as f_svg:
                    svg_content = f_svg.read()
                    svg_content = re.sub(r'<\?xml.*?\?>\s*', '', svg_content).strip()
                    svg_content = svg_content.replace('<svg ', '<svg class="article-inline-svg" ', 1)


                    svg_content = re.sub(r'\s*\n\s*', ' ', svg_content)
                    return svg_content
        return f'<img src="{url}" alt="{alt}">'

    body = re.sub(r'!\[([^\]]*)\]\(([^\)]+)\)', replace_image, body)
    body = markdown_to_html(body)

    data = {}
    current_list_key = None

    for line in frontmatter_str.splitlines():
        if line.startswith('  - '):
            if current_list_key:
                val = line[4:].strip().strip('"').strip("'")
                if val:
                    data[current_list_key].append(val)
        elif ':' in line:
            key, val = line.split(':', 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if not val:
                current_list_key = key
                data[key] = []
            else:
                data[key] = val
                current_list_key = None

    return data, body

def build():
    chapters = []
    articles = {}

    chapters_dir = '_chapters'
    articles_dir = '_articles'


    if os.path.exists(chapters_dir):
        for f in sorted(os.listdir(chapters_dir)):
            if f.endswith('.md'):
                data, _ = parse_md(os.path.join(chapters_dir, f))
                if data:
                    chap = {
                        "id": data.get('slug', ''),
                        "title": data.get('title', ''),
                        "indexTitle": data.get('indexTitle', ''),
                        "articles": data.get('articles', [])
                    }
                    chapters.append(chap)


    if os.path.exists(articles_dir):
        for root, dirs, files in os.walk(articles_dir):
            for f in files:
                if f.endswith('.md'):
                    data, body = parse_md(os.path.join(root, f))
                    if data:
                        slug = data.get('slug', f[:-3])
                        articles[slug] = {
                            "title": data.get('title', ''),
                            "plainTitle": data.get('plainTitle', data.get('title', '')),
                            "description": data.get('description', ''),
                            "image": data.get('image', ''),
                            "chapterId": data.get('chapterId', ''),
                            "content": body
                        }


    for chap in chapters:
        art_list = []
        for a_id in chap.get('articles', []):
            if a_id in articles:
                a_data = articles[a_id]
                art_list.append({
                    "id": a_id,
                    "title": a_data.get('plainTitle', a_data.get('title', '')),
                    "description": a_data.get('description', '')
                })
            else:

                art_list.append({
                    "id": a_id,
                    "title": a_id
                })
        chap['articles'] = art_list

    cms_data = {
        "chapters": chapters,
        "articles": articles
    }


    js_content = "window.cmsData = " + json.dumps(cms_data, ensure_ascii=False, indent=2) + ";\n"
    with open('js/content.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    print("Successfully built js/content.js")


    with open('data/content.json', 'w', encoding='utf-8') as f:
        json.dump(cms_data, f, ensure_ascii=False, indent=2)
    print("Successfully built data/content.json")

if __name__ == '__main__':
    build()

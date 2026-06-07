import os
import re

def verify_images():
    articles_dir = '_articles'
    img_dir = 'img'
    
    # Get all files in img/
    existing_images = set()
    if os.path.exists(img_dir):
        for f in os.listdir(img_dir):
            existing_images.add(os.path.join(img_dir, f))
            
    print(f"Found {len(existing_images)} files in {img_dir}/")
    
    missing_count = 0
    # Walk through articles
    for root, dirs, files in os.walk(articles_dir):
        for f in files:
            if f.endswith('.md'):
                filepath = os.path.join(root, f)
                with open(filepath, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                # Find all ![alt](url)
                matches = re.findall(r'!\[([^\]]*)\]\(([^\)]+)\)', content)
                for alt, url in matches:
                    # Resolve relative path or simple name
                    resolved_url = url
                    if resolved_url.startswith('img/'):
                        pass
                    else:
                        resolved_url = os.path.join('img', os.path.basename(resolved_url))
                        
                    if resolved_url not in existing_images and not resolved_url.endswith('.svg'):
                        # Try to find if there is a file that starts with the base prefix
                        basename = os.path.basename(resolved_url)
                        prefix = basename.split('-')[0] + '-' + basename.split('-')[1] if len(basename.split('-')) > 1 else basename
                        
                        # Find potential matches
                        potentials = [img for img in existing_images if os.path.basename(img).startswith(prefix)]
                        
                        print(f"\nMissing image in {filepath}:")
                        print(f"  Referenced: {url}")
                        if potentials:
                            print(f"  Did you mean: {', '.join([os.path.basename(p) for p in potentials])}?")
                        else:
                            print(f"  No similar files starting with '{prefix}' found.")
                        missing_count += 1
                        
    print(f"\nVerification complete. Total missing image links: {missing_count}")

if __name__ == '__main__':
    verify_images()

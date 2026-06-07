class CMSClient {
  constructor(dataSourceUrl) {
    this.dataSourceUrl = dataSourceUrl;
    this.data = null;
  }

  async loadData() {
    if (this.data) return this.data;

    
    if (window.cmsData) {
      this.data = window.cmsData;
      return this.data;
    }

    try {
      
      const response = await fetch(`${this.dataSourceUrl}?t=${new Date().getTime()}`);
      this.data = await response.json();
      return this.data;
    } catch (err) {
      console.error('Failed to load CMS data', err);
      return null;
    }
  }

  getParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }

  async renderArticle() {
    const articleId = this.getParam('id');
    
    const id = articleId || 'composition-basics';

    await this.loadData();
    const article = this.data.articles[id];
    if (!article) {
      console.warn('Article not found:', id);
      return;
    }

    const chapter = this.data.chapters.find(c => c.id === article.chapterId);

    document.title = `${article.plainTitle} - ДОВІДНИК ДИЗАЙНЕРА ГАЗЕТИ`;

    document.title = `${article.plainTitle} - ДОВІДНИК ДИЗАЙНЕРА ГАЗЕТИ`;

    this.setHtml('[data-cms="title"]', article.title);
    this.setHtml('[data-cms="content"]', article.content);
    
    
    const heroWrapper = document.querySelector('[data-cms="hero-image-wrapper"]');
    if (heroWrapper) {
      if (article.image) {
        heroWrapper.innerHTML = `<img src="${article.image}" alt="Illustration" class="article-hero-image" />`;
      } else {
        heroWrapper.innerHTML = '';
      }
    }

    if (chapter) {
      this.setHtml('[data-cms="breadcrumb-chapter"]', chapter.title);
      this.setAttribute('[data-cms="breadcrumb-chapter"]', 'href', `chapter.html?id=${chapter.id}`);
      this.setAttribute('[data-cms="back-link"]', 'href', `chapter.html?id=${chapter.id}`);
    }
    this.setHtml('[data-cms="breadcrumb-current"]', article.plainTitle);

    
    this.applyAutoLayout();

    
    this.initRevealAnimation();

    this.buildTOC();
    this.initProgressBar();
    this.buildNextNav(chapter, id);
    this.initLightboxGallery();
  }

  /**
   * Normalises a CSS/SVG colour value to lowercase hex so we can compare
   * against a target background colour consistently.
   * Handles: #fff, #ffffff, white, rgb(255,255,255), rgba(255,255,255,*)
   */
  _normalizeColor(value) {
    if (!value) return null;
    const v = value.trim().toLowerCase();
    if (v === 'white' || v === '#fff' || v === '#ffffff') return '#ffffff';
    // rgb(255, 255, 255) / rgba(255, 255, 255, 1)
    const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
      const [, r, g, b] = rgb.map(Number);
      if (r === 255 && g === 255 && b === 255) return '#ffffff';
    }
    return v;
  }

  /**
   * Recursively walk all SVG elements and make any element whose fill
   * matches bgColor fully transparent.
   * @param {SVGElement} node  – root element to start from
   * @param {string}     bgColor – normalised hex target, e.g. '#ffffff'
   */
  _removeSvgBackground(node, bgColor) {
    if (!node || !node.children) return;
    Array.from(node.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      
      // Do not change background/fill for text elements
      if (tag === 'text' || tag === 'tspan' || tag === 'textpath') {
        this._removeSvgBackground(child, bgColor);
        return;
      }

      // Check `fill` attribute
      const fillAttr = child.getAttribute('fill');
      if (this._normalizeColor(fillAttr) === bgColor) {
        child.setAttribute('fill', 'transparent');
      }

      // Check inline style `fill` and `background`
      const styleFill = child.style && child.style.fill;
      if (styleFill && this._normalizeColor(styleFill) === bgColor) {
        child.style.fill = 'transparent';
      }
      const styleBg = child.style && child.style.background;
      if (styleBg && this._normalizeColor(styleBg) === bgColor) {
        child.style.background = 'transparent';
      }

      // Recurse into children
      this._removeSvgBackground(child, bgColor);
    });
  }

  applyAutoLayout() {
    const BG_COLOR = '#ffffff';
    const contentContainer = document.querySelector('.article-content');
    if (!contentContainer) return;

    // Helper functions
    function isImageOrSvg(el) {
      if (el.dataset.layoutProcessed === 'true') return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'img' || tag === 'figure' || el.classList.contains('article-inline-svg');
    }

    function isQuote(el) {
      return el.tagName.toLowerCase() === 'blockquote' || el.classList.contains('article-quote');
    }

    function isTextParagraph(el) {
      return el.tagName.toLowerCase() === 'p' && !el.querySelector('img, svg');
    }

    function getImageRatio(img) {
      let ratio = 1;
      let target = img;
      if (img.tagName.toLowerCase() === 'figure') {
        target = img.querySelector('img, svg');
        if (!target) return 1;
      }
      if (target.tagName.toLowerCase() === 'svg') {
        const viewBox = target.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(' ').map(parseFloat);
          if (parts.length === 4 && parts[3] !== 0) ratio = parts[2] / parts[3];
        } else {
          const w = parseFloat(target.getAttribute('width'));
          const h = parseFloat(target.getAttribute('height'));
          if (!isNaN(w) && !isNaN(h) && h !== 0) ratio = w / h;
        }
      } else {
        ratio = target.naturalWidth / target.naturalHeight;
      }
      return ratio || 1;
    }

    function processStandaloneImage(img) {
      img.style.opacity = '0';
      const run = () => {
        let ratio = getImageRatio(img);
        const targetImg = img.tagName.toLowerCase() === 'figure' ? img.querySelector('img, svg') : img;

        // Remove SVG white backgrounds
        if (targetImg && targetImg.tagName.toLowerCase() === 'svg') {
          targetImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          window.cmsClient._removeSvgBackground(targetImg, BG_COLOR);
        }

        if (ratio >= 1.4) {
          img.classList.add('img-layout-full-width');
        } else if (ratio <= 0.8) {
          img.classList.add('img-layout-float-right');
          img.classList.add('img-portrait');
        } else {
          // Alternating floats for standard images
          img.classList.add(alternateGrid ? 'img-layout-offset-left' : 'img-layout-float-right');
          alternateGrid = !alternateGrid;
        }
        img.style.opacity = '';
      };

      const targetImg = img.tagName.toLowerCase() === 'figure' ? img.querySelector('img, svg') : img;
      if (!targetImg) {
        run();
      } else if (targetImg.tagName.toLowerCase() === 'svg' || (targetImg.complete && targetImg.naturalHeight !== 0)) {
        run();
      } else {
        targetImg.addEventListener('load', run);
      }
    }

    function processGridImage(img, grid) {
      img.style.opacity = '0';
      const run = () => {
        let ratio = getImageRatio(img);
        const targetImg = img.tagName.toLowerCase() === 'figure' ? img.querySelector('img, svg') : img;

        if (targetImg && targetImg.tagName.toLowerCase() === 'svg') {
          targetImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          window.cmsClient._removeSvgBackground(targetImg, BG_COLOR);
        }

        // Apply grid proportions based on image ratio
        grid.classList.remove('layout-half', 'layout-sidebar', 'layout-asymmetric', 'layout-asymmetric-reverse', 'layout-triptych', 'layout-triptych-reverse');
        
        if (ratio < 0.8) {
          // Portrait image: use sidebar layout (1fr 3fr)
          grid.classList.add('layout-sidebar');
        } else if (ratio >= 1.4) {
          // Wide image: use triptych (2fr 1fr)
          grid.classList.add('layout-triptych');
        } else {
          // Square/Standard image: use layout-half (1fr 1fr)
          grid.classList.add('layout-half');
        }
        img.style.opacity = '';
      };

      const targetImg = img.tagName.toLowerCase() === 'figure' ? img.querySelector('img, svg') : img;
      if (!targetImg) {
        run();
      } else if (targetImg.tagName.toLowerCase() === 'svg' || (targetImg.complete && targetImg.naturalHeight !== 0)) {
        run();
      } else {
        targetImg.addEventListener('load', run);
      }
    }

    // 1. Pre-process: Unwrap images/SVGs that are the sole contents of a <p>
    const paragraphs = Array.from(contentContainer.querySelectorAll('p'));
    paragraphs.forEach(p => {
      const children = Array.from(p.children);
      const text = p.textContent.trim();
      if (children.length === 1 && 
          (children[0].tagName.toLowerCase() === 'img' || children[0].classList.contains('article-inline-svg')) && 
          text === '') {
        p.parentNode.replaceChild(children[0], p);
      }
    });

    // 1.1 Pre-process: Wrap images/SVGs and their captions in <figure>
    let currentChildren = Array.from(contentContainer.children);
    for (let j = 0; j < currentChildren.length; j++) {
      const el = currentChildren[j];
      const tag = el.tagName.toLowerCase();
      if (tag === 'img' || el.classList.contains('article-inline-svg')) {
        // Check if the next sibling is a caption
        const nextEl = currentChildren[j + 1];
        let captionEl = null;
        if (nextEl && nextEl.tagName.toLowerCase() === 'p') {
          const firstChild = nextEl.firstElementChild;
          const text = nextEl.textContent.trim();
          const isItalicP = nextEl.children.length === 1 && firstChild && (firstChild.tagName === 'EM' || firstChild.tagName === 'I');
          if (isItalicP && text.length < 250) {
            captionEl = nextEl;
          }
        }

        const figure = document.createElement('figure');
        figure.className = 'article-figure';
        
        el.parentNode.insertBefore(figure, el);
        figure.appendChild(el);
        if (captionEl) {
          const figcaption = document.createElement('figcaption');
          figcaption.className = 'article-figcaption';
          figcaption.innerHTML = captionEl.innerHTML;
          figure.appendChild(figcaption);
          captionEl.parentNode.removeChild(captionEl);
          j++;
        }
      }
    }

    // 1.2 Pre-process: Group layout examples into a gallery
    const isLayoutDescList = (el) => {
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'ul' && tag !== 'ol') return false;
      const lis = el.querySelectorAll('li');
      if (lis.length === 0) return false;
      for (let li of lis) {
        const first = li.firstElementChild;
        if (first && (first.tagName.toLowerCase() === 'strong' || first.tagName.toLowerCase() === 'b')) {
          return true;
        }
      }
      return false;
    };

    const processRun = (elements) => {
      const figures = elements.filter(el => el.tagName.toLowerCase() === 'figure');
      if (figures.length < 3) return null;

      // Extract items
      const items = [];
      const startsWithList = (elements[0].tagName.toLowerCase() === 'ul' || elements[0].tagName.toLowerCase() === 'ol');

      if (startsWithList) {
        let currentTexts = [];
        elements.forEach(el => {
          const tag = el.tagName.toLowerCase();
          if (tag === 'ul' || tag === 'ol') {
            const lis = Array.from(el.querySelectorAll('li'));
            lis.forEach(li => {
              const strongEl = li.querySelector('strong, b');
              let title = '';
              let desc = li.innerHTML;
              if (strongEl) {
                title = strongEl.textContent.trim().replace(/:$/, '');
                const clone = li.cloneNode(true);
                const cloneStrong = clone.querySelector('strong, b');
                if (cloneStrong) clone.removeChild(cloneStrong);
                desc = clone.innerHTML.trim().replace(/^[:\s\-\.\–\—]+/, '');
              }
              currentTexts.push({ title, desc });
            });
          } else if (tag === 'figure') {
            items.push({
              figure: el,
              texts: [...currentTexts]
            });
            currentTexts = [];
          }
        });
      } else {
        let currentFigure = null;
        let currentTexts = [];
        elements.forEach(el => {
          const tag = el.tagName.toLowerCase();
          if (tag === 'figure') {
            if (currentFigure) {
              items.push({
                figure: currentFigure,
                texts: [...currentTexts]
              });
              currentTexts = [];
            }
            currentFigure = el;
          } else if (tag === 'ul' || tag === 'ol') {
            const lis = Array.from(el.querySelectorAll('li'));
            lis.forEach(li => {
              const strongEl = li.querySelector('strong, b');
              let title = '';
              let desc = li.innerHTML;
              if (strongEl) {
                title = strongEl.textContent.trim().replace(/:$/, '');
                const clone = li.cloneNode(true);
                const cloneStrong = clone.querySelector('strong, b');
                if (cloneStrong) clone.removeChild(cloneStrong);
                desc = clone.innerHTML.trim().replace(/^[:\s\-\.\–\—]+/, '');
              }
              currentTexts.push({ title, desc });
            });
          }
        });
        if (currentFigure) {
          items.push({
            figure: currentFigure,
            texts: [...currentTexts]
          });
        }
      }

      if (items.length < 3) return null;

      // Construct Gallery DOM
      const gallery = document.createElement('div');
      gallery.className = 'editorial-layout-gallery';

      const inner = document.createElement('div');
      inner.className = 'gallery-inner';
      gallery.appendChild(inner);

      const viewport = document.createElement('div');
      viewport.className = 'gallery-viewport';
      inner.appendChild(viewport);

      const slideContainer = document.createElement('div');
      slideContainer.className = 'gallery-slide-container';
      viewport.appendChild(slideContainer);

      const info = document.createElement('div');
      info.className = 'gallery-info';
      inner.appendChild(info);

      const infoContent = document.createElement('div');
      infoContent.className = 'gallery-info-content';
      info.appendChild(infoContent);

      const layoutTitle = document.createElement('h3');
      layoutTitle.className = 'gallery-layout-title';
      infoContent.appendChild(layoutTitle);

      const layoutDesc = document.createElement('div');
      layoutDesc.className = 'gallery-layout-desc';
      infoContent.appendChild(layoutDesc);

      const controls = document.createElement('div');
      controls.className = 'gallery-controls';
      gallery.appendChild(controls);

      const btnPrev = document.createElement('button');
      btnPrev.className = 'gallery-btn gallery-btn-prev';
      btnPrev.innerHTML = '&larr;';
      btnPrev.setAttribute('aria-label', 'Previous slide');
      controls.appendChild(btnPrev);

      const dotsContainer = document.createElement('div');
      dotsContainer.className = 'gallery-nav-dots';
      controls.appendChild(dotsContainer);

      const btnNext = document.createElement('button');
      btnNext.className = 'gallery-btn gallery-btn-next';
      btnNext.innerHTML = '&rarr;';
      btnNext.setAttribute('aria-label', 'Next slide');
      controls.appendChild(btnNext);

      const counter = document.createElement('div');
      counter.className = 'gallery-counter';
      controls.appendChild(counter);

      let activeIndex = 0;
      
      const updateGallery = () => {
        slideContainer.innerHTML = '';
        layoutDesc.innerHTML = '';

        const currentItem = items[activeIndex];
        
        const clonedFigure = currentItem.figure.cloneNode(true);
        clonedFigure.dataset.layoutProcessed = 'true';
        const targetImg = clonedFigure.querySelector('img, svg');
        if (targetImg) {
          targetImg.style.opacity = '0';
          const run = () => {
            if (targetImg.tagName.toLowerCase() === 'svg') {
              targetImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              window.cmsClient._removeSvgBackground(targetImg, BG_COLOR);
            }
            targetImg.style.opacity = '';
          };
          if (targetImg.tagName.toLowerCase() === 'svg' || (targetImg.complete && targetImg.naturalHeight !== 0)) {
            run();
          } else {
            targetImg.addEventListener('load', run);
          }
        }
        slideContainer.appendChild(clonedFigure);

        if (currentItem.texts.length > 0) {
          const mainTitle = currentItem.texts[0].title || 'Макет';
          layoutTitle.textContent = mainTitle;
          
          currentItem.texts.forEach(textItem => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'gallery-desc-item';
            
            if (currentItem.texts.length > 1 && textItem.title) {
              const subTitle = document.createElement('h4');
              subTitle.className = 'gallery-desc-subtitle';
              subTitle.textContent = textItem.title;
              itemDiv.appendChild(subTitle);
            }
            
            const p = document.createElement('p');
            p.className = 'gallery-desc-text';
            p.innerHTML = textItem.desc;
            itemDiv.appendChild(p);
            layoutDesc.appendChild(itemDiv);
          });
        } else {
          layoutTitle.textContent = 'Приклад верстки';
          layoutDesc.textContent = '';
        }

        counter.textContent = `${activeIndex + 1} / ${items.length}`;

        const dots = dotsContainer.querySelectorAll('.gallery-dot');
        dots.forEach((dot, idx) => {
          if (idx === activeIndex) {
            dot.classList.add('active');
          } else {
            dot.classList.remove('active');
          }
        });
      };

      items.forEach((_, idx) => {
        const dot = document.createElement('span');
        dot.className = 'gallery-dot';
        if (idx === 0) dot.classList.add('active');
        dot.addEventListener('click', () => {
          activeIndex = idx;
          updateGallery();
        });
        dotsContainer.appendChild(dot);
      });

      btnPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateGallery();
      });

      btnNext.addEventListener('click', (e) => {
        e.stopPropagation();
        activeIndex = (activeIndex + 1) % items.length;
        updateGallery();
      });

      updateGallery();

      // Insert and remove original elements
      const parent = elements[0].parentNode;
      parent.insertBefore(gallery, elements[0]);
      elements.forEach(el => {
        el.parentNode.removeChild(el);
      });

      // Mark all matched figures & images as layoutProcessed
      items.forEach(item => {
        item.figure.dataset.layoutProcessed = 'true';
        const img = item.figure.querySelector('img, svg');
        if (img) img.dataset.layoutProcessed = 'true';
      });

      return gallery;
    };

    let checkChildren = Array.from(contentContainer.children);
    let currentCandidates = [];
    for (let k = 0; k < checkChildren.length; k++) {
      const el = checkChildren[k];
      const tag = el.tagName.toLowerCase();
      const isFigure = (tag === 'figure');
      const isDescList = isLayoutDescList(el);

      if (isFigure || isDescList) {
        currentCandidates.push(el);
      } else {
        if (currentCandidates.length > 0) {
          const galleryEl = processRun(currentCandidates);
          if (galleryEl) {
            checkChildren = Array.from(contentContainer.children);
            k = checkChildren.indexOf(galleryEl);
          }
          currentCandidates = [];
        }
      }
    }
    if (currentCandidates.length > 0) {
      processRun(currentCandidates);
    }

    let alternateGrid = false; // To alternate column directions
    let children = [];
    let i = 0;
    // Track recent premium layouts to prevent consecutive repetition
    const recentLayouts = [];
    function pickLayout(candidates) {
      // Filter out layouts used in last 2 slots
      const available = candidates.filter(c => !recentLayouts.slice(-2).includes(c));
      const chosen = available.length > 0 ? available[0] : candidates[0];
      recentLayouts.push(chosen);
      if (recentLayouts.length > 4) recentLayouts.shift();
      return chosen;
    }

    // 2. PASS 1: Pattern A (Three-Column Triptych Grid)
    // Matches: [img, p, img, p, img, p] OR [img, img, img, p, p, p]
    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 5) {
      const el1 = children[i];
      const el2 = children[i+1];
      const el3 = children[i+2];
      const el4 = children[i+3];
      const el5 = children[i+4];
      const el6 = children[i+5];

      let match = false;
      let items = [];

      if (isImageOrSvg(el1) && isTextParagraph(el2) &&
          isImageOrSvg(el3) && isTextParagraph(el4) &&
          isImageOrSvg(el5) && isTextParagraph(el6)) {
        match = true;
        items = [
          { img: el1, p: el2 },
          { img: el3, p: el4 },
          { img: el5, p: el6 }
        ];
      } else if (isImageOrSvg(el1) && isImageOrSvg(el2) && isImageOrSvg(el3) &&
                 isTextParagraph(el4) && isTextParagraph(el5) && isTextParagraph(el6)) {
        match = true;
        items = [
          { img: el1, p: el4 },
          { img: el2, p: el5 },
          { img: el3, p: el6 }
        ];
      }

      if (match) {
        const grid = document.createElement('div');
        grid.className = 'layout-grid layout-three-cols';
        contentContainer.insertBefore(grid, el1);

        items.forEach(item => {
          item.img.dataset.layoutProcessed = 'true';
          const col = document.createElement('div');
          col.className = 'grid-col';
          col.appendChild(item.img);
          col.appendChild(item.p);
          grid.appendChild(col);

          item.img.style.opacity = '0';
          const run = () => {
            if (item.img.tagName.toLowerCase() === 'svg') {
              item.img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              window.cmsClient._removeSvgBackground(item.img, BG_COLOR);
            }
            item.img.style.opacity = '';
          };
          if (item.img.tagName.toLowerCase() === 'svg' || (item.img.complete && item.img.naturalHeight !== 0)) {
            run();
          } else {
            item.img.addEventListener('load', run);
          }
        });

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }
      i++;
    }

    // 2.5. PASS 1.5: Pattern E (Complex Staggered Triple-Column Triptych)
    // Matches: [h3/h2, p, img, p]
    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 3) {
      const el1 = children[i];
      const el2 = children[i+1];
      const el3 = children[i+2];
      const el4 = children[i+3];

      const tag1 = el1.tagName.toLowerCase();

      if ((tag1 === 'h2' || tag1 === 'h3') && 
          isTextParagraph(el2) && 
          isImageOrSvg(el3) && 
          isTextParagraph(el4)) {
        
        el3.dataset.layoutProcessed = 'true';

        const grid = document.createElement('div');
        grid.className = 'layout-staggered-triptych';
        contentContainer.insertBefore(grid, el1);

        const col1 = document.createElement('div');
        col1.className = 'triptych-col-1';
        col1.appendChild(el1);
        col1.appendChild(el2);

        const col2 = document.createElement('div');
        col2.className = 'triptych-col-2';
        col2.appendChild(el3);

        const col3 = document.createElement('div');
        col3.className = 'triptych-col-3';
        col3.appendChild(el4);

        grid.appendChild(col1);
        grid.appendChild(col2);
        grid.appendChild(col3);

        // Process image inside the grid
        el3.style.opacity = '0';
        const run = () => {
          if (el3.tagName.toLowerCase() === 'svg') {
            el3.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            window.cmsClient._removeSvgBackground(el3, BG_COLOR);
          }
          el3.style.opacity = '';
        };
        if (el3.tagName.toLowerCase() === 'svg' || (el3.complete && el3.naturalHeight !== 0)) {
          run();
        } else {
          el3.addEventListener('load', run);
        }

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }
      i++;
    }

    // PASS 2 (Pattern B / Under-Image Columns) was removed to allow paragraphs under wide focal images to naturally flow in a single comfortable column.

    // 4. PASS 3: Pattern C (Newspaper Quote Focus)
    // Matches: [blockquote, p, p] OR [p, p, blockquote]
    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 2) {
      const el1 = children[i];
      const el2 = children[i+1];
      const el3 = children[i+2];

      let match = false;
      let quoteEl, p1, p2;
      let quoteFirst = true;

      if (isQuote(el1) && isTextParagraph(el2) && isTextParagraph(el3)) {
        match = true;
        quoteEl = el1;
        p1 = el2;
        p2 = el3;
        quoteFirst = true;
      } else if (isTextParagraph(el1) && isTextParagraph(el2) && isQuote(el3)) {
        match = true;
        p1 = el1;
        p2 = el2;
        quoteEl = el3;
        quoteFirst = false;
      }

      if (match) {
        const grid = document.createElement('div');
        grid.className = 'layout-grid layout-half';
        contentContainer.insertBefore(grid, el1);

        const colQuote = document.createElement('div');
        colQuote.className = 'grid-col';
        colQuote.appendChild(quoteEl);

        const colText = document.createElement('div');
        colText.className = 'grid-col';
        colText.appendChild(p1);
        colText.appendChild(p2);

        if (quoteFirst) {
          grid.appendChild(colQuote);
          grid.appendChild(colText);
        } else {
          grid.appendChild(colText);
          grid.appendChild(colQuote);
        }

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }
      i++;
    }

    // 5. PASS 4: Pattern D (Asymmetric Sidebar Story)
    // Matches: [h3, portrait image, p]
    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 2) {
      const el1 = children[i];
      const el2 = children[i+1];
      const el3 = children[i+2];

      if (el1.tagName.toLowerCase() === 'h3' && isImageOrSvg(el2) && isTextParagraph(el3)) {
        el2.dataset.layoutProcessed = 'true';
        
        const grid = document.createElement('div');
        grid.className = 'layout-grid layout-sidebar';
        contentContainer.insertBefore(grid, el1);

        const colSidebar = document.createElement('div');
        colSidebar.className = 'grid-col';
        colSidebar.appendChild(el1);
        colSidebar.appendChild(el2);

        const colContent = document.createElement('div');
        colContent.className = 'grid-col';
        colContent.appendChild(el3);

        grid.appendChild(colSidebar);
        grid.appendChild(colContent);

        processGridImage(el2, grid);

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }
      i++;
    }

    // 6. PASS 5: Group consecutive images
    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length) {
      const current = children[i];
      if (isImageOrSvg(current)) {
        let imageGroup = [current];
        let nextIdx = i + 1;
        while (nextIdx < children.length && isImageOrSvg(children[nextIdx])) {
          imageGroup.push(children[nextIdx]);
          nextIdx++;
        }

        if (imageGroup.length >= 2) {
          if (imageGroup.length >= 4) {
            // New Carousel logic
            const carousel = document.createElement('div');
            carousel.className = 'editorial-carousel';
            contentContainer.insertBefore(carousel, current);

            const trackContainer = document.createElement('div');
            trackContainer.className = 'carousel-track-container';
            carousel.appendChild(trackContainer);

            const track = document.createElement('div');
            track.className = 'carousel-track';
            trackContainer.appendChild(track);

            imageGroup.forEach((img, idx) => {
              img.dataset.layoutProcessed = 'true';
              const slide = document.createElement('div');
              slide.className = `carousel-slide ${idx === 0 ? 'active' : ''}`;
              slide.appendChild(img);
              track.appendChild(slide);

              const targetImg = img.tagName.toLowerCase() === 'figure' ? img.querySelector('img, svg') : img;
              if (targetImg) {
                targetImg.style.opacity = '0';
                const run = () => {
                  if (targetImg.tagName.toLowerCase() === 'svg') {
                    targetImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                    window.cmsClient._removeSvgBackground(targetImg, BG_COLOR);
                  }
                  targetImg.style.opacity = '';
                };
                if (targetImg.tagName.toLowerCase() === 'svg' || (targetImg.complete && targetImg.naturalHeight !== 0)) {
                  run();
                } else {
                  targetImg.addEventListener('load', run);
                }
              }
            });

            const prevBtn = document.createElement('button');
            prevBtn.className = 'carousel-btn carousel-btn-prev';
            prevBtn.innerHTML = '&larr;';
            prevBtn.setAttribute('aria-label', 'Previous slide');
            carousel.appendChild(prevBtn);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'carousel-btn carousel-btn-next';
            nextBtn.innerHTML = '&rarr;';
            nextBtn.setAttribute('aria-label', 'Next slide');
            carousel.appendChild(nextBtn);

            const nav = document.createElement('div');
            nav.className = 'carousel-nav';
            carousel.appendChild(nav);

            imageGroup.forEach((_, idx) => {
              const indicator = document.createElement('span');
              indicator.className = `carousel-indicator ${idx === 0 ? 'active' : ''}`;
              nav.appendChild(indicator);
            });

            const counter = document.createElement('div');
            counter.className = 'carousel-counter';
            counter.textContent = `1 / ${imageGroup.length}`;
            carousel.appendChild(counter);

            this.initCarousel(carousel);

            children = Array.from(contentContainer.children);
            i = children.indexOf(carousel) + 1;
            continue;
          } else {
            // Existing logic for 2 or 3 images
            const grid = document.createElement('div');
            grid.className = 'layout-grid';
            if (imageGroup.length === 2) {
              grid.classList.add('layout-half');
            } else {
              grid.classList.add('layout-three-cols');
            }

            contentContainer.insertBefore(grid, current);

            imageGroup.forEach(img => {
              img.dataset.layoutProcessed = 'true';
              const col = document.createElement('div');
              col.className = 'grid-col';
              col.appendChild(img);
              grid.appendChild(col);
            });

            // Wait for images to render correctly
            imageGroup.forEach(img => {
              img.style.opacity = '0';
              const run = () => {
                const targetImg = img.tagName.toLowerCase() === 'figure' ? img.querySelector('img, svg') : img;
                if (targetImg && targetImg.tagName.toLowerCase() === 'svg') {
                  targetImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                  window.cmsClient._removeSvgBackground(targetImg, BG_COLOR);
                }
                img.style.opacity = '';
              };
              const targetImg = img.tagName.toLowerCase() === 'figure' ? img.querySelector('img, svg') : img;
              if (!targetImg) {
                run();
              } else if (targetImg.tagName.toLowerCase() === 'svg' || (targetImg.complete && targetImg.naturalHeight !== 0)) {
                run();
              } else {
                targetImg.addEventListener('load', run);
              }
            });

            children = Array.from(contentContainer.children);
            i = children.indexOf(grid) + 1;
            continue;
          }
        }
      }
      i++;
    }

    // 6.5. PASS 5.5: Pattern F (Illustrated Editorial List)
    // Matches: [ul/ol, img] or [img, ul/ol]
    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 1) {
      const el1 = children[i];
      const el2 = children[i+1];

      function isList(el) {
        if (!el) return false;
        const tag = el.tagName.toLowerCase();
        return tag === 'ul' || tag === 'ol';
      }

      if ((isList(el1) && isImageOrSvg(el2)) || (isImageOrSvg(el1) && isList(el2))) {
        const listEl = isList(el1) ? el1 : el2;
        const imgEl = isImageOrSvg(el1) ? el1 : el2;

        imgEl.dataset.layoutProcessed = 'true';

        const grid = document.createElement('div');
        grid.className = 'layout-illustrated-list';
        if (alternateGrid) {
          grid.classList.add('layout-reverse');
        }
        alternateGrid = !alternateGrid;

        contentContainer.insertBefore(grid, el1);

        const imgCol = document.createElement('div');
        imgCol.className = 'list-img-col';
        imgCol.appendChild(imgEl);

        const textCol = document.createElement('div');
        textCol.className = 'list-text-col';
        textCol.appendChild(listEl);

        if (grid.classList.contains('layout-reverse')) {
          grid.appendChild(textCol);
          grid.appendChild(imgCol);
        } else {
          grid.appendChild(imgCol);
          grid.appendChild(textCol);
        }

        imgEl.style.opacity = '0';
        const run = () => {
          if (imgEl.tagName.toLowerCase() === 'svg') {
            imgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            window.cmsClient._removeSvgBackground(imgEl, BG_COLOR);
          }
          imgEl.style.opacity = '';
        };
        if (imgEl.tagName.toLowerCase() === 'svg' || (imgEl.complete && imgEl.naturalHeight !== 0)) {
          run();
        } else {
          imgEl.addEventListener('load', run);
        }

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }
      i++;
    }

    // 7. PASS 6: Pair short text and quotes with standalone images
    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length) {
      const current = children[i];
      const tag = current.tagName.toLowerCase();

      // Skip headings, already grouped grids, and next-navigation
      if (tag === 'h2' || tag === 'h3' || current.classList.contains('layout-grid') || current.classList.contains('article-next-navigation')) {
        i++;
        continue;
      }

      // Check for Quote & Image Pair (Rule 2)
      const next = children[i + 1];
      if (next && !next.classList.contains('layout-grid') && ((isQuote(current) && isImageOrSvg(next)) || (isImageOrSvg(current) && isQuote(next)))) {
        const quoteEl = isQuote(current) ? current : next;
        const imgEl = isImageOrSvg(current) ? current : next;

        imgEl.dataset.layoutProcessed = 'true';

        const grid = document.createElement('div');
        grid.className = 'layout-grid layout-half';

        contentContainer.insertBefore(grid, current);

        const col1 = document.createElement('div');
        col1.className = 'grid-col';
        const col2 = document.createElement('div');
        col2.className = 'grid-col';

        // Alternate quote/image order
        if (alternateGrid) {
          col1.appendChild(imgEl);
          col2.appendChild(quoteEl);
        } else {
          col1.appendChild(quoteEl);
          col2.appendChild(imgEl);
        }
        alternateGrid = !alternateGrid;

        grid.appendChild(col1);
        grid.appendChild(col2);

        processGridImage(imgEl, grid);

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }

      // Check for Text & Image Pair (Rule 3)
      if (next && !next.classList.contains('layout-grid') && !next.classList.contains('layout-spotlight-columns') && !next.classList.contains('layout-inset-panel') && !next.classList.contains('layout-portrait-profile') && ((isTextParagraph(current) && isImageOrSvg(next)) || (isImageOrSvg(current) && isTextParagraph(next)))) {
        const textEl = isTextParagraph(current) ? current : next;
        const imgEl = isImageOrSvg(current) ? current : next;
        const charCount = textEl.textContent.trim().length;

        if (charCount >= 300) {
          // Premium Magazine & Newspaper Layouts for long/normal paragraphs
          imgEl.dataset.layoutProcessed = 'true';

          const grid = document.createElement('div');
          // Add basic layout class first, will be updated to final class synchronously or upon load
          grid.className = 'layout-grid-pending';
          contentContainer.insertBefore(grid, current);

          // Append temporarily to keep DOM indices synchronous and avoid dangles
          grid.appendChild(imgEl);
          grid.appendChild(textEl);

          imgEl.style.opacity = '0';

          const runPremium = () => {
            let ratio = getImageRatio(imgEl);

            if (imgEl.tagName.toLowerCase() === 'svg') {
              imgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              window.cmsClient._removeSvgBackground(imgEl, BG_COLOR);
            }

            // Clear placeholder structure
            grid.innerHTML = '';

            if (ratio >= 1.4) {
              // Choose between Spotlight Columns and Overlapping Collage, avoiding repeats
              const wideLayouts = ['layout-spotlight-columns', 'layout-overlapping-collage'];
              const chosenWide = pickLayout(wideLayouts);

              if (chosenWide === 'layout-spotlight-columns') {
                // Layout 1: Newspaper Column Spread (Spotlight Columns)
                grid.className = 'layout-spotlight-columns';

                const textCol = document.createElement('div');
                textCol.className = 'text-column-wrapper';
                textCol.appendChild(textEl);

                grid.appendChild(imgEl);
                grid.appendChild(textCol);
              } else {
                // Layout 5: Wide Image + Text Below (clean, Porsche-style)
                grid.className = 'layout-overlapping-collage';

                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'collage-img-wrapper';
                imgWrapper.appendChild(imgEl);

                const card = document.createElement('div');
                card.className = 'collage-card';
                card.appendChild(textEl);

                grid.appendChild(imgWrapper);
                grid.appendChild(card);
              }
            } else if (ratio <= 0.8) {
              // Choose portrait profile layout, avoiding repeat
              const chosen = pickLayout(['layout-portrait-profile']);
              // Layout 3: Asymmetric Portrait Profile
              grid.className = chosen;
              if (alternateGrid) {
                grid.classList.add('layout-reverse');
              }

              const imgCol = document.createElement('div');
              imgCol.className = 'profile-img-col';
              imgCol.appendChild(imgEl);

              const altText = imgEl.getAttribute('alt');
              if (altText && altText !== 'placeholder') {
                const caption = document.createElement('div');
                caption.className = 'profile-caption';
                caption.textContent = altText;
                imgCol.appendChild(caption);
              }

              const textCol = document.createElement('div');
              textCol.className = 'profile-text-col';
              textCol.appendChild(textEl);

              if (grid.classList.contains('layout-reverse')) {
                grid.appendChild(textCol);
                grid.appendChild(imgCol);
              } else {
                grid.appendChild(imgCol);
                grid.appendChild(textCol);
              }
            } else {
              // Choose inset panel layout, avoiding repeat
              const chosen = pickLayout(['layout-inset-panel']);
              // Layout 2: Editorial Inset Feature (Standard/Square Box)
              grid.className = chosen;
              if (alternateGrid) {
                grid.classList.add('layout-reverse');
              }

              const imgCol = document.createElement('div');
              imgCol.className = 'panel-img-col';
              imgCol.appendChild(imgEl);

              const textCol = document.createElement('div');
              textCol.className = 'panel-text-col';
              textCol.appendChild(textEl);

              if (grid.classList.contains('layout-reverse')) {
                grid.appendChild(textCol);
                grid.appendChild(imgCol);
              } else {
                grid.appendChild(imgCol);
                grid.appendChild(textCol);
              }
            }
            imgEl.style.opacity = '';
            if (window.cmsClient && typeof window.cmsClient.updateDropCap === 'function') {
              window.cmsClient.updateDropCap();
            }
          };

          if (imgEl.tagName.toLowerCase() === 'svg' || (imgEl.complete && imgEl.naturalHeight !== 0)) {
            runPremium();
          } else {
            imgEl.addEventListener('load', runPremium);
          }

          alternateGrid = !alternateGrid;
          children = Array.from(contentContainer.children);
          i = children.indexOf(grid) + 1;
          continue;
        } else {
          // Fallback to original Rule 3 pairing for short text (charCount < 300)
          
          // Transitional Image Protection: do not pair an image if it has text paragraphs immediately before and after it.
          const imgIdx = children.indexOf(imgEl);
          const prevEl = imgIdx > 0 ? children[imgIdx - 1] : null;
          const afterImgEl = imgIdx < children.length - 1 ? children[imgIdx + 1] : null;
          if (prevEl && isTextParagraph(prevEl) && afterImgEl && isTextParagraph(afterImgEl)) {
            if (current === imgEl) {
              processStandaloneImage(imgEl);
            }
            i++;
            continue;
          }

          // Skip pairing if the paragraph is before the image and is followed by a long body paragraph (Pattern B / wide focal layout)
          if (current === textEl && next === imgEl) {
            const afterImg = children[children.indexOf(imgEl) + 1];
            if (afterImg && isTextParagraph(afterImg) && afterImg.textContent.trim().length > 120) {
              i++;
              continue;
            }
          }

          imgEl.dataset.layoutProcessed = 'true';

          const grid = document.createElement('div');
          grid.className = 'layout-grid'; // Exact class will be set by processGridImage

          contentContainer.insertBefore(grid, current);

          const col1 = document.createElement('div');
          col1.className = 'grid-col';
          const col2 = document.createElement('div');
          col2.className = 'grid-col';

          if (alternateGrid) {
            col1.appendChild(imgEl);
            col2.appendChild(textEl);
          } else {
            col1.appendChild(textEl);
            col2.appendChild(imgEl);
          }
          alternateGrid = !alternateGrid;

          grid.appendChild(col1);
          grid.appendChild(col2);

          processGridImage(imgEl, grid);

          children = Array.from(contentContainer.children);
          i = children.indexOf(grid) + 1;
          continue;
        }
      }

      // If it's a single standalone image/svg (not grouped), apply standard single image templates
      if (isImageOrSvg(current)) {
        processStandaloneImage(current);
      }

      i++;
    }

    this.updateDropCap();
  }

  updateDropCap() {
    const contentContainer = document.querySelector('.article-content');
    if (!contentContainer) return;

    // 1. Remove existing drop cap classes to avoid multiple drop caps
    contentContainer.querySelectorAll('.article-drop-cap').forEach(el => {
      el.classList.remove('article-drop-cap');
    });

    // 2. Find the first true narrative paragraph in the article
    const allPs = Array.from(contentContainer.querySelectorAll('p'));
    const firstTextP = allPs.find(p => {
      // Ensure it's not inside blockquote, caption, list, etc.
      if (p.closest('blockquote, .article-quote, figcaption, .profile-caption, .collage-card-caption, .list-img-col')) return false;
      if (p.closest('.article-next-navigation, .toc, [data-cms="toc"]')) return false;
      
      // Ensure it has text
      const text = p.textContent.trim();
      if (text.length === 0) return false;
      
      return true;
    });

    if (firstTextP) {
      firstTextP.classList.add('article-drop-cap');
    }
  }

  initCarousel(carousel) {
    const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
    const prevBtn = carousel.querySelector('.carousel-btn-prev');
    const nextBtn = carousel.querySelector('.carousel-btn-next');
    const indicators = Array.from(carousel.querySelectorAll('.carousel-indicator'));
    const counter = carousel.querySelector('.carousel-counter');
    
    let currentIndex = 0;
    
    function showSlide(index) {
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;
      
      slides[currentIndex].classList.remove('active');
      indicators[currentIndex].classList.remove('active');
      
      currentIndex = index;
      
      slides[currentIndex].classList.add('active');
      indicators[currentIndex].classList.add('active');
      
      if (counter) {
        counter.textContent = `${currentIndex + 1} / ${slides.length}`;
      }
    }
    
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide(currentIndex - 1);
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide(currentIndex + 1);
      });
    }
    
    indicators.forEach((indicator, idx) => {
      indicator.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide(idx);
      });
    });
  }

  initRevealAnimation() {
    const contentContainer = document.querySelector('.article-content');
    const header = document.querySelector('.article-header');
    if (!contentContainer) return;

    const elements = Array.from(contentContainer.children);
    if (header) elements.unshift(header); 
    
    elements.forEach(el => {
      el.classList.add('reveal-item');
      
      
      let svgs = [];
      if (el.tagName.toLowerCase() === 'svg' && el.classList.contains('article-inline-svg')) svgs.push(el);
      else svgs = Array.from(el.querySelectorAll('svg.article-inline-svg'));
      
      svgs.forEach(svg => {
        const segments = Array.from(svg.children).filter(child => {
          const tag = child.tagName.toLowerCase();
          return tag !== 'defs' && tag !== 'title' && tag !== 'desc' && tag !== 'style';
        });
        segments.forEach(seg => seg.classList.add('svg-segment'));
      });
    });

    let currentlyIntersecting = [];
    let staggerTimeout = null;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          currentlyIntersecting.push(entry.target);
          observer.unobserve(entry.target);
        }
      });

      
      if (currentlyIntersecting.length > 0 && !staggerTimeout) {
        staggerTimeout = setTimeout(() => {
          
          currentlyIntersecting.sort((a, b) => {
            return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
          });

          currentlyIntersecting.forEach((el, i) => {
            
            const delay = Math.min(i * 30, 300);
            setTimeout(() => {
              el.classList.add('visible');
              
              
              let svgs = [];
              if (el.tagName.toLowerCase() === 'svg' && el.classList.contains('article-inline-svg')) svgs.push(el);
              else svgs = Array.from(el.querySelectorAll('svg.article-inline-svg'));
              
              svgs.forEach(svg => {
                const segments = Array.from(svg.querySelectorAll('.svg-segment'));
                segments.forEach((seg, index) => {
                  setTimeout(() => {
                    seg.classList.add('svg-segment-visible');
                  }, index * 100); 
                });
              });

            }, delay);
          });
          currentlyIntersecting = [];
          staggerTimeout = null;
        }, 10);
      }
    }, {
      rootMargin: '0px 0px -20px 0px', 
      threshold: 0.05
    });

    elements.forEach(el => {
      observer.observe(el);
    });
  }

  buildNextNav(chapter, currentArticleId) {
    const nextNav = document.querySelector('[data-cms="next-nav"]');
    if (!nextNav || !chapter) return;

    const articleIndex = chapter.articles.findIndex(a => a.id === currentArticleId);
    let nextArticle = null;

    if (articleIndex >= 0 && articleIndex < chapter.articles.length - 1) {
      nextArticle = chapter.articles[articleIndex + 1];
    } else {
      const chapterIndex = this.data.chapters.findIndex(c => c.id === chapter.id);
      if (chapterIndex >= 0 && chapterIndex < this.data.chapters.length - 1) {
        const nextChapter = this.data.chapters[chapterIndex + 1];
        if (nextChapter.articles && nextChapter.articles.length > 0) {
          nextArticle = nextChapter.articles[0];
        }
      }
    }

    if (nextArticle) {
      nextNav.innerHTML = `
        <a href="article.html?id=${nextArticle.id}" class="next-article-btn">
          <div class="next-label">Далее &rarr;</div>
          <div class="next-title">${nextArticle.title}</div>
        </a>
      `;
    } else {
      nextNav.innerHTML = '';
    }
  }

  buildTOC() {
    const tocContainer = document.querySelector('[data-cms="toc"]');
    const contentContainer = document.querySelector('.article-content');
    if (!tocContainer || !contentContainer) return;

    const headings = contentContainer.querySelectorAll('h2');
    if (headings.length === 0) return;

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    ul.style.margin = '0';
    ul.style.display = 'flex';
    ul.style.flexDirection = 'column';
    ul.style.gap = '1rem';

    headings.forEach((heading, index) => {
      // Assign ID if it doesn't have one
      if (!heading.id) {
        heading.id = `subchapter-${index + 1}`;
      }

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${heading.id}`;
      a.className = 'toc-link';
      a.textContent = heading.textContent;
      
      // Smooth scroll behavior
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const y = heading.getBoundingClientRect().top + window.scrollY - 40; // 40px offset
        window.scrollTo({ top: y, behavior: 'smooth' });
        history.pushState(null, null, `#${heading.id}`);
      });

      li.appendChild(a);
      ul.appendChild(li);
    });

    tocContainer.appendChild(ul);
    
    // Add scroll spy to highlight active TOC link
    this.initTOCScrollSpy(headings, ul);
  }

  initTOCScrollSpy(headings, ul) {
    const links = ul.querySelectorAll('.toc-link');
    window.addEventListener('scroll', () => {
      let current = '';
      headings.forEach(heading => {
        const headingTop = heading.getBoundingClientRect().top;
        if (headingTop <= 150) { 
          current = heading.id;
        }
      });

      links.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
          link.classList.add('active');
        }
      });
    }, { passive: true });
  }

  initProgressBar() {
    const progressBar = document.querySelector('.reading-progress-bar');
    if (!progressBar) return;

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight > 0) {
        const scrolled = (scrollTop / scrollHeight) * 100;
        progressBar.style.width = `${scrolled}%`;
      }
    }, { passive: true });
  }

  async renderChapter() {
    const chapterId = this.getParam('id');
    const id = chapterId || 'chapter-1';

    await this.loadData();
    const chapter = this.data.chapters.find(c => c.id === id);
    if (!chapter) {
      console.warn('Chapter not found:', id);
      return;
    }

    document.title = `${chapter.title} - ДОВІДНИК ДИЗАЙНЕРА ГАЗЕТИ`;

    this.setHtml('[data-cms="chapter-title"]', chapter.title);
    this.setHtml('[data-cms="breadcrumb-current"]', chapter.title);

    const listContainer = document.querySelector('[data-cms="article-list"]');
    if (listContainer) {
      listContainer.innerHTML = '';
      
      const chapterNumMatch = id.match(/\d+/);
      const chapterNum = chapterNumMatch ? chapterNumMatch[0] : '1';

      chapter.articles.forEach((art, index) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `article.html?id=${art.id}`;
        a.className = 'chapter-item';

        const h2 = document.createElement('h2');
        h2.className = 'chapter-number';
        
        const p = document.createElement('p');
        p.className = 'chapter-title';

        if (id === 'preface') {
          h2.textContent = art.title;
          p.innerHTML = art.description || '';
        } else {
          h2.textContent = `${chapterNum}.${index + 1}`;
          p.innerHTML = art.title;
        }

        a.appendChild(h2);
        a.appendChild(p);
        li.appendChild(a);
        listContainer.appendChild(li);
      });
    }
  }

  setHtml(selector, html) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = html;
  }

  setAttribute(selector, attr, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  initLightboxGallery() {
    const contentContainer = document.querySelector('.article-content');
    if (!contentContainer) return;

    // 1. Gather all interactive images/SVGs in the article (excluding the main cover page hero image)
    const articleImages = Array.from(contentContainer.querySelectorAll('img, svg.article-inline-svg'));
    if (articleImages.length === 0) return;

    // 2. Dynamically create Lightbox DOM if not already present
    let lightbox = document.getElementById('editorialLightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'editorialLightbox';
      lightbox.className = 'editorial-lightbox';
      lightbox.innerHTML = `
        <button class="lightbox-close" id="lightboxClose" title="Закрыть">&times;</button>
        <button class="lightbox-nav lightbox-prev" id="lightboxPrev" title="Предыдущее">&lsaquo;</button>
        <button class="lightbox-nav lightbox-next" id="lightboxNext" title="Следующее">&rsaquo;</button>
        <div class="lightbox-content">
          <div class="lightbox-image-container" id="lightboxImgContainer">
            <img src="" alt="" class="lightbox-image" id="lightboxImage" />
          </div>
          <div class="lightbox-caption" id="lightboxCaption"></div>
        </div>
        <div class="lightbox-bottom-bar">
          <div class="lightbox-controls">
            <span class="control-label">Масштаб:</span>
            <input type="range" min="100" max="400" step="5" value="100" id="lightboxZoomSlider" class="lightbox-zoom-slider" />
            <div class="lightbox-percent-wrapper">
              <input type="number" min="100" max="400" id="lightboxZoomPercent" class="lightbox-zoom-percent-input" value="100" />
              <span class="percent-symbol">%</span>
            </div>
            <button class="lightbox-zoom-btn" id="lightboxZoomReset" title="Сбросить">Сбросить</button>
          </div>
          <div class="lightbox-thumbnails-wrapper" id="lightboxThumbsWrapper"></div>
        </div>
      `;
      document.body.appendChild(lightbox);
    }

    const lightboxImg = document.getElementById('lightboxImage');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const btnClose = document.getElementById('lightboxClose');
    const btnPrev = document.getElementById('lightboxPrev');
    const btnNext = document.getElementById('lightboxNext');
    const btnZoomReset = document.getElementById('lightboxZoomReset');
    const imgContainer = document.getElementById('lightboxImgContainer');
    
    const zoomSlider = document.getElementById('lightboxZoomSlider');
    const zoomPercentInput = document.getElementById('lightboxZoomPercent');
    const thumbsWrapper = document.getElementById('lightboxThumbsWrapper');

    let currentIndex = 0;
    let zoomLevel = 1.0;
    let isDragging = false;
    let startX = 0, startY = 0;
    let translateX = 0, translateY = 0;

    // Helper: update transform (scale + translation for pan)
    const updateImageTransform = () => {
      lightboxImg.style.transform = `scale(${zoomLevel}) translate(${translateX / zoomLevel}px, ${translateY / zoomLevel}px)`;
    };

    // Helper: Sync Zoom controls UI state
    const updateZoomUI = () => {
      const percentage = Math.round(zoomLevel * 100);
      zoomSlider.value = percentage;
      zoomPercentInput.value = percentage;
      updateImageTransform();
      lightboxImg.style.cursor = zoomLevel > 1.0 ? 'move' : 'grab';
    };

    // Helper: Reset zoom and pan
    const resetZoomAndPan = () => {
      zoomLevel = 1.0;
      translateX = 0;
      translateY = 0;
      updateZoomUI();
    };

    // Helper: Open image in lightbox at specific index
    const openImage = (index) => {
      if (index < 0 || index >= articleImages.length) return;
      currentIndex = index;
      resetZoomAndPan();

      const targetEl = articleImages[currentIndex];
      let src = '';
      let alt = '';

      if (targetEl.tagName.toLowerCase() === 'svg') {
        // Serialize inline SVG to data URL
        const svgString = new XMLSerializer().serializeToString(targetEl);
        src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
        alt = 'Векторная схема';
      } else {
        src = targetEl.getAttribute('src');
        alt = targetEl.getAttribute('alt') || 'Иллюстрация';
      }

      lightboxImg.setAttribute('src', src);
      lightboxCaption.textContent = alt === 'placeholder' ? '' : alt;

      // Toggle nav visibility if single image
      if (articleImages.length <= 1) {
        btnPrev.style.display = 'none';
        btnNext.style.display = 'none';
        thumbsWrapper.style.display = 'none';
      } else {
        btnPrev.style.display = 'block';
        btnNext.style.display = 'block';
        thumbsWrapper.style.display = 'flex';
      }

      // Sync active thumbnail styling and scroll into view
      const thumbs = thumbsWrapper.querySelectorAll('.lightbox-thumb');
      thumbs.forEach((thumb, idx) => {
        if (idx === currentIndex) {
          thumb.classList.add('thumb-active');
          thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
          thumb.classList.remove('thumb-active');
        }
      });

      lightbox.classList.add('lightbox-active');
      document.body.style.overflow = 'hidden'; // disable background scroll
    };

    // Helper: Close lightbox
    const closeLightbox = () => {
      lightbox.classList.remove('lightbox-active');
      document.body.style.overflow = '';
      resetZoomAndPan();
    };

    // 3. Populate Thumbnails Bar
    thumbsWrapper.innerHTML = '';
    articleImages.forEach((imgEl, idx) => {
      let thumbSrc = '';
      if (imgEl.tagName.toLowerCase() === 'svg') {
        const svgString = new XMLSerializer().serializeToString(imgEl);
        thumbSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
      } else {
        thumbSrc = imgEl.getAttribute('src');
      }

      const thumb = document.createElement('img');
      thumb.className = 'lightbox-thumb';
      thumb.src = thumbSrc;
      thumb.alt = `Миниатюра ${idx + 1}`;
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        openImage(idx);
      });
      thumbsWrapper.appendChild(thumb);
    });

    // Attach click events to article images
    articleImages.forEach((el, index) => {
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openImage(index);
      });
    });

    // Navigation and Close buttons
    btnClose.addEventListener('click', closeLightbox);

    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      let prevIdx = currentIndex - 1;
      if (prevIdx < 0) prevIdx = articleImages.length - 1; // cycle
      openImage(prevIdx);
    });

    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      let nextIdx = currentIndex + 1;
      if (nextIdx >= articleImages.length) nextIdx = 0; // cycle
      openImage(nextIdx);
    });

    // Zoom Controls logic
    
    // A. Range Slider input handler
    zoomSlider.addEventListener('input', (e) => {
      const percent = parseInt(e.target.value, 10);
      zoomLevel = percent / 100;
      zoomPercentInput.value = percent;
      updateImageTransform();
      lightboxImg.style.cursor = zoomLevel > 1.0 ? 'move' : 'grab';
    });

    // B. Numeric Input field percentage handler
    zoomPercentInput.addEventListener('input', (e) => {
      let percent = parseInt(e.target.value, 10);
      if (isNaN(percent)) return;
      
      // Limit bounds on typing
      if (percent < 100) percent = 100;
      if (percent > 400) percent = 400;
      
      zoomLevel = percent / 100;
      zoomSlider.value = percent;
      updateImageTransform();
      lightboxImg.style.cursor = zoomLevel > 1.0 ? 'move' : 'grab';
    });

    // Prevent propagation on typing inside zoom input so it doesn't trigger layout hotkeys
    zoomPercentInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    btnZoomReset.addEventListener('click', (e) => {
      e.stopPropagation();
      resetZoomAndPan();
    });

    // Pan / Drag implementation
    imgContainer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (zoomLevel <= 1.0) return; // only pan when zoomed in
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      lightboxImg.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateImageTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        lightboxImg.style.cursor = 'move';
      }
    });

    // Close on click outside content
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === imgContainer || e.target === lightbox.querySelector('.lightbox-content')) {
        closeLightbox();
      }
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('lightbox-active')) return;
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        btnPrev.click();
      } else if (e.key === 'ArrowRight') {
        btnNext.click();
      }
    });
  }
}

window.cmsClient = new CMSClient('data/content.json');

document.addEventListener('DOMContentLoaded', async () => {
  const pageType = document.documentElement.getAttribute('data-cms-page') || document.body.getAttribute('data-cms-page');

  if (pageType === 'article') {
    await window.cmsClient.renderArticle();
  } else if (pageType === 'chapter') {
    await window.cmsClient.renderChapter();
  }

  
  window.dispatchEvent(new Event('cms:loaded'));

  
  window.dispatchEvent(new Event('cms:rendered'));
});

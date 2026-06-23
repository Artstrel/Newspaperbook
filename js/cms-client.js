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


    this._rand = this._makeSeededRandom(String(id));

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
        heroWrapper.innerHTML = `<img src="${article.image}" alt="Ілюстрація" class="article-hero-image" />`;
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

    this.buildArticleTopbar(article, chapter);
    this.buildTOC();
    this.initProgressBar();
    this.buildPrevNav(chapter, id);
    this.buildNextNav(chapter, id);
    this.initLightboxGallery();
  }


  _makeSeededRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = (h ^ (h >>> 16)) >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _normalizeColor(value) {
    if (!value) return null;
    const v = value.trim().toLowerCase();
    if (v === 'white' || v === '#fff' || v === '#ffffff') return '#ffffff';
    const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
      const [, r, g, b] = rgb.map(Number);
      if (r === 255 && g === 255 && b === 255) return '#ffffff';
    }
    return v;
  }


  _removeSvgBackground(node, bgColor) {
    if (!node || !node.children) return;
    Array.from(node.children).forEach(child => {
      const tag = child.tagName.toLowerCase();


      if (tag === 'text' || tag === 'tspan' || tag === 'textpath') {
        this._removeSvgBackground(child, bgColor);
        return;
      }

      const fillAttr = child.getAttribute('fill');
      if (this._normalizeColor(fillAttr) === bgColor) {
        child.setAttribute('fill', 'transparent');
      }

      const styleFill = child.style && child.style.fill;
      if (styleFill && this._normalizeColor(styleFill) === bgColor) {
        child.style.fill = 'transparent';
      }
      const styleBg = child.style && child.style.background;
      if (styleBg && this._normalizeColor(styleBg) === bgColor) {
        child.style.background = 'transparent';
      }


      this._removeSvgBackground(child, bgColor);
    });
  }


  _transformQABlocks(container) {
    if (!container) return;

    const QUESTION_RE = /^Питання\s*:?\s*$/;
    const ANSWER_RE = /^Відповідь\s*:?\s*$/;
    const SECTION_RE = /Вирішення проблем/;


    const markerKind = (el) => {
      if (!el || (el.tagName !== 'STRONG' && el.tagName !== 'EM')) return null;
      const t = el.textContent.trim();
      if (QUESTION_RE.test(t)) return 'q';
      if (ANSWER_RE.test(t)) return 'a';
      return null;
    };

    const buildText = (nodes) => {
      const wrap = document.createElement('div');
      wrap.className = 'qa-text';
      nodes.forEach(n => wrap.appendChild(n));
      const first = wrap.firstChild;
      if (first && first.nodeType === Node.TEXT_NODE) {

        first.textContent = first.textContent.replace(/^[\s:.\-–—]+/, '');
      }
      return wrap;
    };

    const makeItem = (kind, nodes) => {
      const item = document.createElement('div');
      item.className = 'qa-item ' + (kind === 'q' ? 'qa-question' : 'qa-answer');
      const tag = document.createElement('span');
      tag.className = 'qa-tag';
      tag.setAttribute('aria-hidden', 'true');
      tag.textContent = kind === 'q' ? 'П' : 'В';
      item.appendChild(tag);
      item.appendChild(buildText(nodes));
      return item;
    };

    Array.from(container.children).forEach(p => {
      if (p.tagName !== 'P') return;
      if (p.querySelector('img, svg')) return;

      const markers = Array.from(p.querySelectorAll('strong, em'))
        .filter(el => markerKind(el));
      if (markers.length === 0) return;

      const nodes = Array.from(p.childNodes);

      const leadEl = nodes.find(n =>
        n.nodeType === Node.ELEMENT_NODE && !markerKind(n) && SECTION_RE.test(n.textContent));


      const firstMeaningful = nodes.find(n => {
        if (n === leadEl) return false;
        if (n.nodeType === Node.TEXT_NODE) return n.textContent.trim().length > 0;
        return true;
      });
      if (!markers.includes(firstMeaningful)) return;


      const markerEls = new Set(markers);
      const seg = { q: [], a: [] };
      let current = null;
      nodes.forEach(n => {
        if (n === leadEl) return;
        if (markerEls.has(n)) { current = markerKind(n); return; }
        if (current) seg[current].push(n);
      });

      const block = document.createElement('div');
      block.className = 'qa-block';


      if (seg.q.length) block.appendChild(makeItem('q', seg.q));
      if (seg.a.length) block.appendChild(makeItem('a', seg.a));

      if (block.querySelector('.qa-item')) {
        p.parentNode.replaceChild(block, p);
      }
    });
  }

  applyAutoLayout() {
    const BG_COLOR = '#ffffff';
    const contentContainer = document.querySelector('.article-content');
    if (!contentContainer) return;


    this._ensureDeckleFilter();


    this._transformQABlocks(contentContainer);


    const whenReady = (el, run) => {
      const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
      const trigger = tag === 'figure' ? el.querySelector('img, svg') : el;
      if (!trigger || trigger.tagName.toLowerCase() === 'svg' || trigger.complete) {
        run();
        return;
      }
      const onSettled = () => {
        trigger.removeEventListener('load', onSettled);
        trigger.removeEventListener('error', onSettled);
        run();
      };
      trigger.addEventListener('load', onSettled);
      trigger.addEventListener('error', onSettled);
    };


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


    function getImageDims(img) {
      let target = img;
      if (img.tagName.toLowerCase() === 'figure') {
        target = img.querySelector('img, svg');
        if (!target) return { ratio: 1, width: 0 };
      }
      const ratio = getImageRatio(img);
      let width = 0;
      if (target.tagName.toLowerCase() !== 'svg') {
        width = target.naturalWidth || 0;
      }
      return { ratio, width };
    }

    function processStandaloneImage(img) {
      img.style.opacity = '0';
      const run = () => {
        const { ratio, width } = getImageDims(img);
        const targetImg = img.tagName.toLowerCase() === 'figure' ? img.querySelector('img, svg') : img;


        if (targetImg && targetImg.tagName.toLowerCase() === 'svg') {
          targetImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          window.cmsClient._removeSvgBackground(targetImg, BG_COLOR);
        }

        if (ratio >= 1.4) {


          const panoramic = ratio >= 2.0;
          if (panoramic && !(width && width < 760)) {
            img.classList.add('img-layout-full-width');
          } else {
            img.classList.add(pickSide() ? 'img-layout-offset-left' : 'img-layout-float-right');
            img.classList.add('img-layout-wide');
          }
        } else if (ratio <= 0.8) {

          img.classList.add(pickSide() ? 'img-layout-offset-left' : 'img-layout-float-right');
          img.classList.add('img-portrait');
        } else {

          img.classList.add(pickSide() ? 'img-layout-offset-left' : 'img-layout-float-right');
        }


        if (width) img.style.maxWidth = 'min(100%, ' + width + 'px)';

        img.style.opacity = '';
      };

      whenReady(img, run);
    }


    function framePhoto(img) {
      if (!img || img.tagName.toLowerCase() !== 'img') return;
      if (img.closest('.photo-frame, .filmstrip-paper, .editorial-layout-gallery')) return;
      const frame = document.createElement('div');
      frame.className = 'photo-frame';
      img.parentNode.insertBefore(frame, img);
      frame.appendChild(img);


      const setRatio = () => {
        if (img.naturalWidth && img.naturalHeight) {
          frame.style.setProperty('--photo-ratio', img.naturalWidth + ' / ' + img.naturalHeight);


          frame.style.maxWidth = 'min(100%, ' + img.naturalWidth + 'px)';
          capCaptionedCrop();
        }
      };


      const sizeToTextCol = img.closest('.panel-img-col, .list-img-col, .triptych-col-2');
      const figcap = frame.parentElement
        && frame.parentElement.tagName.toLowerCase() === 'figure'
        && frame.parentElement.querySelector(':scope > figcaption');
      function capCaptionedCrop() {
        if (!sizeToTextCol || !figcap || typeof ResizeObserver === 'undefined') return;
        if (!img.naturalWidth || !img.naturalHeight) return;
        const ratio = img.naturalWidth / img.naturalHeight;
        const apply = () => {
          const w = frame.getBoundingClientRect().width;
          if (w) frame.style.maxHeight = Math.round(w / ratio) + 'px';
        };
        apply();
        new ResizeObserver(apply).observe(sizeToTextCol);
      }

      if (img.complete && img.naturalWidth) setRatio();
      else img.addEventListener('load', setRatio, { once: true });
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


        grid.classList.remove('layout-half', 'layout-sidebar', 'layout-asymmetric', 'layout-asymmetric-reverse', 'layout-triptych', 'layout-triptych-reverse');

        if (ratio < 0.8) {

          grid.classList.add('layout-sidebar');
        } else if (ratio >= 1.4) {

          grid.classList.add('layout-triptych');
        } else {

          grid.classList.add('layout-half');
        }
        img.style.opacity = '';
      };

      whenReady(img, run);
    }


    const paragraphs = Array.from(contentContainer.querySelectorAll('p'));
    paragraphs.forEach(p => {
      const elementChildren = Array.from(p.children);
      const mediaEls = elementChildren.filter(c =>
        c.tagName.toLowerCase() === 'img' || c.classList.contains('article-inline-svg'));


      if (mediaEls.length !== 1) return;
      const media = mediaEls[0];


      const others = elementChildren.filter(c => c !== media);
      let captionEl = null;
      if (others.length === 1 && (others[0].tagName === 'EM' || others[0].tagName === 'I')) {
        captionEl = others[0];
      } else if (others.length > 0) {
        return;
      }


      const captionText = captionEl ? captionEl.textContent.trim() : '';
      if (p.textContent.trim() !== captionText) return;

      if (captionEl && captionText.length > 0 && captionText.length < 250) {
        const figure = document.createElement('figure');
        figure.className = 'article-figure';
        figure.appendChild(media);
        const figcaption = document.createElement('figcaption');
        figcaption.className = 'article-figcaption';
        figcaption.innerHTML = captionEl.innerHTML;
        figure.appendChild(figcaption);
        p.parentNode.replaceChild(figure, p);
      } else {
        p.parentNode.replaceChild(media, p);
      }
    });


    let currentChildren = Array.from(contentContainer.children);
    for (let j = 0; j < currentChildren.length; j++) {
      const el = currentChildren[j];
      const tag = el.tagName.toLowerCase();
      if (tag === 'img' || el.classList.contains('article-inline-svg')) {

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


    const buildFilmstrip = (mediaEls, beforeNode) => {
      this._ensureDeckleFilter();

      const filmstrip = document.createElement('div');
      filmstrip.className = 'gallery-filmstrip';
      beforeNode.parentNode.insertBefore(filmstrip, beforeNode);

      const track = document.createElement('div');
      track.className = 'filmstrip-track';
      filmstrip.appendChild(track);

      mediaEls.forEach((el) => {
        el.dataset.layoutProcessed = 'true';

        const item = document.createElement('div');
        item.className = 'filmstrip-item';

        const paper = document.createElement('div');
        paper.className = 'filmstrip-paper';


        let captionHtml = '';
        if (el.tagName.toLowerCase() === 'figure') {
          const cap = el.querySelector('figcaption');
          if (cap) {
            captionHtml = cap.innerHTML;
            cap.parentNode.removeChild(cap);
          }
        }

        paper.appendChild(el);
        item.appendChild(paper);

        if (captionHtml) {
          const caption = document.createElement('figcaption');
          caption.className = 'filmstrip-caption';
          caption.innerHTML = captionHtml;
          item.appendChild(caption);
        }

        track.appendChild(item);

        const targetImg = el.tagName.toLowerCase() === 'figure' ? el.querySelector('img, svg') : el;
        if (targetImg) {
          targetImg.style.opacity = '0';
          const run = () => {
            if (targetImg.tagName.toLowerCase() === 'svg') {
              targetImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              window.cmsClient._removeSvgBackground(targetImg, BG_COLOR);
            }
            targetImg.style.opacity = '';
          };
          whenReady(targetImg, run);
        }
      });

      return filmstrip;
    };

    const processRun = (elements) => {
      const figures = elements.filter(el => el.tagName.toLowerCase() === 'figure');
      if (figures.length < 3) return null;


      const isPureImageRun = elements.every(el => el.tagName.toLowerCase() === 'figure');
      if (isPureImageRun) {
        return buildFilmstrip(figures, elements[0]);
      }


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


      this._ensureDeckleFilter();

      const gallery = document.createElement('div');
      gallery.className = 'editorial-layout-gallery';

      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'gallery-item';


        const photoCol = document.createElement('div');
        photoCol.className = 'gallery-photo';

        const clonedFigure = item.figure.cloneNode(true);
        clonedFigure.dataset.layoutProcessed = 'true';
        const media = clonedFigure.querySelector('img, svg');


        const cap = clonedFigure.querySelector('figcaption');
        let captionHtml = '';
        if (cap) { captionHtml = cap.innerHTML; cap.remove(); }

        let frame = null;
        if (media && media.tagName.toLowerCase() === 'img') {

          frame = document.createElement('div');
          frame.className = 'photo-frame';
          media.parentNode.insertBefore(frame, media);
          frame.appendChild(media);
          const setRatio = () => {
            if (media.naturalWidth && media.naturalHeight) {
              frame.style.setProperty('--photo-ratio', media.naturalWidth + ' / ' + media.naturalHeight);


              frame.style.maxWidth = media.naturalWidth + 'px';
            }
          };
          if (media.complete && media.naturalWidth) setRatio();
          else media.addEventListener('load', setRatio, { once: true });
        } else if (media && media.tagName.toLowerCase() === 'svg') {
          media.style.opacity = '0';
          whenReady(media, () => {
            media.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            window.cmsClient._removeSvgBackground(media, BG_COLOR);
            media.style.opacity = '';
          });
        }


        if (captionHtml) {
          const figcap = document.createElement('figcaption');
          figcap.className = 'article-figcaption gallery-photo-caption';
          figcap.innerHTML = captionHtml;
          clonedFigure.appendChild(figcap);
        }
        photoCol.appendChild(clonedFigure);

        row.appendChild(photoCol);


        if (item.texts.length > 0) {
          const info = document.createElement('div');
          info.className = 'gallery-info';

          const layoutTitle = document.createElement('h3');
          layoutTitle.className = 'gallery-layout-title';
          layoutTitle.textContent = item.texts[0].title || 'Макет';
          info.appendChild(layoutTitle);

          const layoutDesc = document.createElement('div');
          layoutDesc.className = 'gallery-layout-desc';
          item.texts.forEach(textItem => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'gallery-desc-item';

            if (item.texts.length > 1 && textItem.title) {
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
          info.appendChild(layoutDesc);
          row.appendChild(info);
        } else {
          row.classList.add('gallery-item-solo');
        }

        gallery.appendChild(row);
      });


      const parent = elements[0].parentNode;
      parent.insertBefore(gallery, elements[0]);
      elements.forEach(el => {
        el.parentNode.removeChild(el);
      });


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


    const rand = () => (window.cmsClient && typeof window.cmsClient._rand === 'function'
      ? window.cmsClient._rand()
      : Math.random());

    let children = [];
    let i = 0;


    const recentLayouts = [];
    function pickLayout(candidates) {
      if (candidates.length === 1) {
        recentLayouts.push(candidates[0]);
        if (recentLayouts.length > 4) recentLayouts.shift();
        return candidates[0];
      }


      const available = candidates.filter(c => !recentLayouts.slice(-1).includes(c));
      const pool = available.length > 0 ? available : candidates;
      const chosen = pool[Math.floor(rand() * pool.length)];
      recentLayouts.push(chosen);
      if (recentLayouts.length > 4) recentLayouts.shift();
      return chosen;
    }


    let __lastSide = null, __sideStreak = 0;
    function pickSide() {
      let left = rand() < 0.5;
      if (left === __lastSide) {
        __sideStreak++;
        if (__sideStreak >= 2) { left = !left; __sideStreak = 0; }
      } else {
        __sideStreak = 0;
      }
      __lastSide = left;
      return left;
    }


    let alternateGrid = rand() < 0.5;


    function buildPremiumLayout(grid, imgEl, textEl, layout, reverse) {
      if (layout === 'layout-spotlight') {
        grid.className = 'layout-spotlight';
        const textCol = document.createElement('div');
        textCol.className = 'text-column-wrapper';
        textCol.appendChild(textEl);
        grid.appendChild(imgEl);
        grid.appendChild(textCol);
      } else if (layout === 'layout-overlapping-collage') {
        grid.className = 'layout-overlapping-collage';
        if (reverse) grid.classList.add('layout-reverse');
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'collage-img-wrapper';
        imgWrapper.appendChild(imgEl);
        const card = document.createElement('div');
        card.className = 'collage-card';
        card.appendChild(textEl);
        grid.appendChild(imgWrapper);
        grid.appendChild(card);
      } else if (layout === 'layout-portrait-profile') {
        grid.className = 'layout-portrait-profile';
        if (reverse) grid.classList.add('layout-reverse');
        const imgCol = document.createElement('div');
        imgCol.className = 'profile-img-col';
        imgCol.appendChild(imgEl);
        const altText = imgEl.getAttribute && imgEl.getAttribute('alt');
        if (altText && altText !== 'placeholder') {
          const caption = document.createElement('div');
          caption.className = 'profile-caption';
          caption.textContent = altText;
          imgCol.appendChild(caption);
        }
        const textCol = document.createElement('div');
        textCol.className = 'profile-text-col';
        textCol.appendChild(textEl);
        if (reverse) { grid.appendChild(textCol); grid.appendChild(imgCol); }
        else { grid.appendChild(imgCol); grid.appendChild(textCol); }
      } else {

        grid.className = 'layout-inset-panel';
        if (reverse) grid.classList.add('layout-reverse');
        const imgCol = document.createElement('div');
        imgCol.className = 'panel-img-col';
        imgCol.appendChild(imgEl);
        const textCol = document.createElement('div');
        textCol.className = 'panel-text-col';
        textCol.appendChild(textEl);
        if (reverse) { grid.appendChild(textCol); grid.appendChild(imgCol); }
        else { grid.appendChild(imgCol); grid.appendChild(textCol); }
      }
    }


    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 5) {
      const el1 = children[i];
      const el2 = children[i + 1];
      const el3 = children[i + 2];
      const el4 = children[i + 3];
      const el5 = children[i + 4];
      const el6 = children[i + 5];

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
          whenReady(item.img, run);
        });

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }
      i++;
    }


    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 3) {
      const el1 = children[i];
      const el2 = children[i + 1];
      const el3 = children[i + 2];
      const el4 = children[i + 3];

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


        el3.style.opacity = '0';
        const run = () => {
          if (el3.tagName.toLowerCase() === 'svg') {
            el3.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            window.cmsClient._removeSvgBackground(el3, BG_COLOR);
          }
          el3.style.opacity = '';
        };
        whenReady(el3, run);

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }
      i++;
    }


    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 2) {
      const el1 = children[i];
      const el2 = children[i + 1];
      const el3 = children[i + 2];

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


    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 2) {
      const el1 = children[i];
      const el2 = children[i + 1];
      const el3 = children[i + 2];

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
          if (imageGroup.length >= 3) {


            const filmstrip = buildFilmstrip(imageGroup, current);

            children = Array.from(contentContainer.children);
            i = children.indexOf(filmstrip) + 1;
            continue;
          } else {

            const grid = document.createElement('div');
            grid.className = 'layout-grid layout-half';

            contentContainer.insertBefore(grid, current);

            imageGroup.forEach(img => {
              img.dataset.layoutProcessed = 'true';
              const col = document.createElement('div');
              col.className = 'grid-col';
              col.appendChild(img);
              grid.appendChild(col);
            });


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
              whenReady(img, run);
            });

            children = Array.from(contentContainer.children);
            i = children.indexOf(grid) + 1;
            continue;
          }
        }
      }
      i++;
    }


    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length - 1) {
      const el1 = children[i];
      const el2 = children[i + 1];

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
        grid.className = 'layout-list-pending';
        contentContainer.insertBefore(grid, el1);
        grid.appendChild(imgEl);
        grid.appendChild(listEl);

        const sideReverse = alternateGrid;
        alternateGrid = !alternateGrid;

        imgEl.style.opacity = '0';

        const buildStacked = () => {
          grid.innerHTML = '';
          grid.className = 'layout-stacked-list';
          const imgWrap = document.createElement('div');
          imgWrap.className = 'stacked-img';
          imgWrap.appendChild(imgEl);
          const listWrap = document.createElement('div');
          listWrap.className = 'stacked-list';
          listWrap.appendChild(listEl);
          grid.appendChild(imgWrap);
          grid.appendChild(listWrap);
        };

        const buildSideBySide = () => {
          grid.innerHTML = '';
          grid.className = 'layout-illustrated-list';
          if (sideReverse) grid.classList.add('layout-reverse');
          const imgCol = document.createElement('div');
          imgCol.className = 'list-img-col';
          imgCol.appendChild(imgEl);
          const textCol = document.createElement('div');
          textCol.className = 'list-text-col';
          textCol.appendChild(listEl);
          // Always append the floated imgCol first so that text content in textCol can flow and wrap around it correctly.
          grid.appendChild(imgCol);
          grid.appendChild(textCol);
        };

        const run = () => {
          const ratio = getImageRatio(imgEl) || 1;
          const { width: natW } = getImageDims(imgEl);
          const media = imgEl.tagName.toLowerCase() === 'figure'
            ? imgEl.querySelector('img, svg') : imgEl;
          if (media && media.tagName.toLowerCase() === 'svg') {
            media.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            window.cmsClient._removeSvgBackground(media, BG_COLOR);
          }

          buildSideBySide();
          imgEl.style.opacity = '';


          const photoCanFillList = () => {
            if (!grid.classList.contains('layout-illustrated-list')) return true;
            const textCol = grid.querySelector('.list-text-col');
            const imgCol = grid.querySelector('.list-img-col');
            if (!textCol || !imgCol) return true;
            const listH = textCol.getBoundingClientRect().height;
            const colW = imgCol.getBoundingClientRect().width;
            if (!listH || !colW) return true;
            const dispW = natW ? Math.min(colW, natW) : colW;
            const imgMaxH = dispW / ratio;
            return imgMaxH >= listH * 0.85;
          };
          // Disable buildStacked layout fallback to allow wrapping lists around images
          // if (!photoCanFillList()) buildStacked();


          const cc = window.cmsClient;
          cc._listFitGrids = cc._listFitGrids || [];
          cc._listFitGrids.push(() => { /* if (!photoCanFillList()) buildStacked(); */ });
          if (!cc._listFitResizeBound) {
            cc._listFitResizeBound = true;
            let t;
            window.addEventListener('resize', () => {
              clearTimeout(t);
              t = setTimeout(() => cc._listFitGrids.forEach(fn => fn()), 200);
            });
          }
        };
        whenReady(imgEl, run);

        children = Array.from(contentContainer.children);
        i = children.indexOf(grid) + 1;
        continue;
      }
      i++;
    }


    children = Array.from(contentContainer.children);
    i = 0;
    while (i < children.length) {
      const current = children[i];
      const tag = current.tagName.toLowerCase();


      if (tag === 'h2' || tag === 'h3' || current.classList.contains('layout-grid') || current.classList.contains('article-next-navigation')) {
        i++;
        continue;
      }


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


      if (next && !next.classList.contains('layout-grid') && !next.classList.contains('layout-spotlight') && !next.classList.contains('layout-inset-panel') && !next.classList.contains('layout-portrait-profile') && ((isTextParagraph(current) && isImageOrSvg(next)) || (isImageOrSvg(current) && isTextParagraph(next)))) {
        const textEl = isTextParagraph(current) ? current : next;
        const imgEl = isImageOrSvg(current) ? current : next;
        const charCount = textEl.textContent.trim().length;


        const imgPrev = imgEl.previousElementSibling;
        if (current === imgEl && imgPrev && /^h[1-6]$/.test(imgPrev.tagName.toLowerCase())) {
          processStandaloneImage(imgEl);
          i++;
          continue;
        }

        if (charCount >= 300) {

          imgEl.dataset.layoutProcessed = 'true';

          const grid = document.createElement('div');

          grid.className = 'layout-grid-pending';
          contentContainer.insertBefore(grid, current);


          grid.appendChild(imgEl);
          grid.appendChild(textEl);

          imgEl.style.opacity = '0';

          const runPremium = () => {
            const { ratio, width } = getImageDims(imgEl);


            const innerEl = imgEl.tagName.toLowerCase() === 'figure'
              ? imgEl.querySelector('img, svg')
              : imgEl;
            if (innerEl && innerEl.tagName.toLowerCase() === 'svg') {
              innerEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              window.cmsClient._removeSvgBackground(innerEl, BG_COLOR);
            }


            grid.innerHTML = '';


            let pool;
            if (ratio >= 1.4) {
              pool = (width && width < 760)
                ? ['layout-inset-panel', 'layout-overlapping-collage']
                : ['layout-spotlight', 'layout-overlapping-collage'];
            } else if (ratio <= 0.8) {
              pool = ['layout-portrait-profile', 'layout-inset-panel'];
            } else {
              pool = ['layout-inset-panel', 'layout-overlapping-collage'];
            }

            const chosen = pickLayout(pool);


            const reverse = chosen === 'layout-spotlight' ? false : pickSide();

            buildPremiumLayout(grid, imgEl, textEl, chosen, reverse);

            imgEl.style.opacity = '';
            if (window.cmsClient && typeof window.cmsClient.updateDropCap === 'function') {
              window.cmsClient.updateDropCap();
            }
          };

          whenReady(imgEl, runPremium);

          children = Array.from(contentContainer.children);
          i = children.indexOf(grid) + 1;
          continue;
        } else {


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


          if (current === textEl && next === imgEl) {
            const afterImg = children[children.indexOf(imgEl) + 1];
            if (afterImg && isTextParagraph(afterImg) && afterImg.textContent.trim().length > 120) {
              i++;
              continue;
            }
          }

          imgEl.dataset.layoutProcessed = 'true';

          const grid = document.createElement('div');
          grid.className = 'layout-grid';

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


      if (isImageOrSvg(current)) {
        processStandaloneImage(current);
      }

      i++;
    }


    contentContainer.querySelectorAll('img').forEach(framePhoto);

    this.updateDropCap();
  }

  updateDropCap() {
    const contentContainer = document.querySelector('.article-content');
    if (!contentContainer) return;


    contentContainer.querySelectorAll('.article-drop-cap').forEach(el => {
      el.classList.remove('article-drop-cap');
    });


    const allPs = Array.from(contentContainer.querySelectorAll('p'));
    const firstTextP = allPs.find(p => {

      if (p.closest('blockquote, .article-quote, figcaption, .profile-caption, .collage-card-caption, .list-img-col')) return false;
      if (p.closest('.article-next-navigation, .toc, [data-cms="toc"]')) return false;


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


  _ensureDeckleFilter() {
    if (document.getElementById('filmstrip-deckle-defs')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'filmstrip-deckle-defs');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
    svg.innerHTML = `
      <defs>
        <filter id="filmstrip-deckle" x="-25%" y="-25%" width="150%" height="150%"
                color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.013 0.019"
                        numOctaves="3" seed="8" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="11"
                             xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>`;
    document.body.appendChild(svg);
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
          <div class="next-label">Далі &rarr;</div>
          <div class="next-title">${nextArticle.title}</div>
        </a>
      `;
    } else {
      nextNav.innerHTML = '';
    }
  }

  buildPrevNav(chapter, currentArticleId) {
    const prevNav = document.querySelector('[data-cms="prev-nav"]');
    if (!prevNav || !chapter) return;

    const articleIndex = chapter.articles.findIndex(a => a.id === currentArticleId);
    let prevArticle = null;

    if (articleIndex > 0) {
      prevArticle = chapter.articles[articleIndex - 1];
    } else if (articleIndex === 0) {
      const chapterIndex = this.data.chapters.findIndex(c => c.id === chapter.id);
      if (chapterIndex > 0) {
        const prevChapter = this.data.chapters[chapterIndex - 1];
        if (prevChapter.articles && prevChapter.articles.length > 0) {
          prevArticle = prevChapter.articles[prevChapter.articles.length - 1];
        }
      }
    }

    if (prevArticle) {
      prevNav.innerHTML = `
        <a href="article.html?id=${prevArticle.id}" class="prev-article-btn">
          <div class="prev-label">&larr; Назад</div>
          <div class="prev-title">${prevArticle.title}</div>
        </a>
      `;
    } else {
      prevNav.innerHTML = '';
    }
  }


  buildArticleTopbar(article, chapter) {
    const topbar = document.querySelector('.article-topbar');
    if (!topbar) return;

    const titleEl = topbar.querySelector('.topbar-title');
    const crumbsEl = topbar.querySelector('.topbar-breadcrumbs');
    const backEl = topbar.querySelector('.topbar-back');
    if (backEl) backEl.setAttribute('href', chapter ? `chapter.html?id=${chapter.id}` : 'index.html');
    if (titleEl) titleEl.textContent = article.plainTitle || '';
    if (crumbsEl) {
      const parts = ['<a href="index.html">Зміст</a>'];
      if (chapter) {
        parts.push('<span class="sep">/</span>');
        parts.push(`<a href="chapter.html?id=${chapter.id}">${chapter.title}</a>`);
      }
      crumbsEl.innerHTML = parts.join(' ');
    }

    const toggle = topbar.querySelector('.topbar-toc-toggle');
    const panel = topbar.querySelector('.topbar-toc-panel');
    const backdrop = document.querySelector('.topbar-backdrop');

    const setOpen = (open) => {
      if (panel) panel.classList.toggle('is-open', open);
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
      if (backdrop) backdrop.classList.toggle('is-open', open);


      topbar.classList.toggle('panel-open', open);
    };

    this._closeTopbarToc = () => setOpen(false);

    if (toggle && panel) {
      toggle.addEventListener('click', () => {
        setOpen(!panel.classList.contains('is-open'));
      });
    }
    if (backdrop) backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });


    const cover = document.querySelector('.article-cover-layout');
    if (cover && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const past = !entry.isIntersecting;
          topbar.classList.toggle('is-visible', past);
          if (!past) setOpen(false);
        });
      }, { rootMargin: '-12px 0px 0px 0px', threshold: 0 });
      io.observe(cover);
    } else {
      topbar.classList.add('is-visible');
    }
  }

  buildTOC() {
    const tocContainer = document.querySelector('[data-cms="toc"]');
    const panelContainer = document.querySelector('.topbar-toc-panel');
    const contentContainer = document.querySelector('.article-content');
    if (!contentContainer) return;

    const headings = contentContainer.querySelectorAll('h2');
    if (headings.length === 0) {

      const toggle = document.querySelector('.topbar-toc-toggle');
      if (toggle) toggle.style.display = 'none';
      return;
    }


    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = `subchapter-${index + 1}`;
    });

    if (tocContainer) {
      tocContainer.appendChild(this._createTocList(headings));
    }
    if (panelContainer) {
      panelContainer.appendChild(this._createTocList(headings, () => {
        if (this._closeTopbarToc) this._closeTopbarToc();
      }));
    }


    this.initTOCScrollSpy(headings);
  }


  _createTocList(headings, onNavigate) {
    const ul = document.createElement('ul');
    ul.className = 'toc-list';

    headings.forEach((heading) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${heading.id}`;
      a.className = 'toc-link';
      a.textContent = heading.textContent;

      a.addEventListener('click', (e) => {
        e.preventDefault();
        const y = heading.getBoundingClientRect().top + window.scrollY - this._tocScrollOffset();
        window.scrollTo({ top: y, behavior: 'smooth' });
        history.pushState(null, null, `#${heading.id}`);
        if (typeof onNavigate === 'function') onNavigate();
      });

      li.appendChild(a);
      ul.appendChild(li);
    });

    return ul;
  }


  _tocScrollOffset() {
    if (window.matchMedia('(max-width: 1024px)').matches) {
      const bar = document.querySelector('.article-topbar-inner');
      return (bar ? bar.offsetHeight : 54) + 16;
    }
    return 40;
  }

  initTOCScrollSpy(headings) {
    const update = () => {
      let current = '';
      headings.forEach(heading => {
        if (heading.getBoundingClientRect().top <= 150) current = heading.id;
      });
      document.querySelectorAll('.toc-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
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


    const articleImages = Array.from(contentContainer.querySelectorAll('img, svg.article-inline-svg'));
    if (articleImages.length === 0) return;


    let lightbox = document.getElementById('editorialLightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'editorialLightbox';
      lightbox.className = 'editorial-lightbox';
      lightbox.innerHTML = `
        <button class="lightbox-close" id="lightboxClose" title="Закрити">&times;</button>
        <button class="lightbox-nav lightbox-prev" id="lightboxPrev" title="Попереднє">&lsaquo;</button>
        <button class="lightbox-nav lightbox-next" id="lightboxNext" title="Наступне">&rsaquo;</button>
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
            <button class="lightbox-zoom-btn" id="lightboxZoomReset" title="Скинути">Скинути</button>
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


    const updateImageTransform = () => {
      lightboxImg.style.transform = `scale(${zoomLevel}) translate(${translateX / zoomLevel}px, ${translateY / zoomLevel}px)`;
    };


    const updateZoomUI = () => {
      const percentage = Math.round(zoomLevel * 100);
      zoomSlider.value = percentage;
      zoomPercentInput.value = percentage;
      updateImageTransform();
      lightboxImg.style.cursor = zoomLevel > 1.0 ? 'move' : 'grab';
    };


    const resetZoomAndPan = () => {
      zoomLevel = 1.0;
      translateX = 0;
      translateY = 0;
      updateZoomUI();
    };


    const openImage = (index) => {
      if (index < 0 || index >= articleImages.length) return;
      currentIndex = index;
      resetZoomAndPan();

      const targetEl = articleImages[currentIndex];
      let src = '';
      let alt = '';

      if (targetEl.tagName.toLowerCase() === 'svg') {

        const svgString = new XMLSerializer().serializeToString(targetEl);
        src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
        alt = 'Векторна схема';
      } else {
        src = targetEl.getAttribute('src');
        alt = targetEl.getAttribute('alt') || 'Ілюстрація';
      }

      lightboxImg.setAttribute('src', src);
      lightboxCaption.textContent = alt === 'placeholder' ? '' : alt;


      if (articleImages.length <= 1) {
        btnPrev.style.display = 'none';
        btnNext.style.display = 'none';
        thumbsWrapper.style.display = 'none';
      } else {
        btnPrev.style.display = 'block';
        btnNext.style.display = 'block';
        thumbsWrapper.style.display = 'flex';
      }


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
      document.body.style.overflow = 'hidden';
    };


    const closeLightbox = () => {
      lightbox.classList.remove('lightbox-active');
      document.body.style.overflow = '';
      resetZoomAndPan();
    };


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
      thumb.alt = `Мініатюра ${idx + 1}`;
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        openImage(idx);
      });
      thumbsWrapper.appendChild(thumb);
    });


    articleImages.forEach((el, index) => {
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openImage(index);
      });
    });


    btnClose.addEventListener('click', closeLightbox);

    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      let prevIdx = currentIndex - 1;
      if (prevIdx < 0) prevIdx = articleImages.length - 1;
      openImage(prevIdx);
    });

    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      let nextIdx = currentIndex + 1;
      if (nextIdx >= articleImages.length) nextIdx = 0;
      openImage(nextIdx);
    });


    zoomSlider.addEventListener('input', (e) => {
      const percent = parseInt(e.target.value, 10);
      zoomLevel = percent / 100;
      zoomPercentInput.value = percent;
      updateImageTransform();
      lightboxImg.style.cursor = zoomLevel > 1.0 ? 'move' : 'grab';
    });


    zoomPercentInput.addEventListener('input', (e) => {
      let percent = parseInt(e.target.value, 10);
      if (isNaN(percent)) return;


      if (percent < 100) percent = 100;
      if (percent > 400) percent = 400;

      zoomLevel = percent / 100;
      zoomSlider.value = percent;
      updateImageTransform();
      lightboxImg.style.cursor = zoomLevel > 1.0 ? 'move' : 'grab';
    });


    zoomPercentInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    btnZoomReset.addEventListener('click', (e) => {
      e.stopPropagation();
      resetZoomAndPan();
    });


    imgContainer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (zoomLevel <= 1.0) return;
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


    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === imgContainer || e.target === lightbox.querySelector('.lightbox-content')) {
        closeLightbox();
      }
    });


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

// Layout Configurator Core Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const templateCards = document.querySelectorAll('.template-card');
  const inputTitle = document.getElementById('input-title');
  const inputQuote = document.getElementById('input-quote');
  const inputAuthor = document.getElementById('input-author');
  const inputText = document.getElementById('input-text');
  const imageOpts = document.querySelectorAll('.image-opt');
  const copyBtn = document.getElementById('copy-code-btn');
  const codeOutput = document.getElementById('code-output');

  // Preview elements
  const previewTitle = document.getElementById('preview-title');
  const dynamicLayoutArea = document.getElementById('dynamic-layout-area');

  // Initial State
  let currentTemplate = 'lead';
  let activeImage = 'img/newspaper_grid_1777876473624.png';

  // Event Listeners for inputs
  inputTitle.addEventListener('input', updatePreview);
  inputQuote.addEventListener('input', updatePreview);
  inputAuthor.addEventListener('input', updatePreview);
  inputText.addEventListener('input', updatePreview);

  // Template switching
  templateCards.forEach(card => {
    card.addEventListener('click', () => {
      templateCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentTemplate = card.dataset.template;
      
      // Show/hide contextual quote inputs
      const quoteFields = document.querySelectorAll('.focus-only');
      if (currentTemplate === 'focus') {
        quoteFields.forEach(f => f.classList.remove('hidden'));
      } else {
        quoteFields.forEach(f => f.classList.add('hidden'));
      }

      updatePreview();
    });
  });

  // Image Selection
  imageOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      imageOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      activeImage = opt.dataset.img;
      updatePreview();
    });
  });

  // Clipboard copy
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(codeOutput.textContent).then(() => {
      copyBtn.textContent = 'Код скопійовано!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Копіювати в буфер';
        copyBtn.classList.remove('copied');
      }, 2000);
    });
  });

  // Update Dynamic Live Preview
  function updatePreview() {
    const titleVal = inputTitle.value.trim() || 'Без заголовка';
    const quoteVal = inputQuote.value.trim();
    const authorVal = inputAuthor.value.trim();
    const textVal = inputText.value.trim() || 'Основний текст буде відображено тут...';

    // Update Title in Preview
    previewTitle.innerHTML = titleVal;

    // Render Preview Layout based on current template
    let layoutHtml = '';

    if (currentTemplate === 'lead') {
      layoutHtml = `
        <div class="layout-grid layout-asymmetric">
          <div class="grid-col">
            <p class="preview-text-dropcap">${textVal}</p>
          </div>
          <div class="grid-col">
            <img src="${activeImage}" alt="Ілюстрація" class="preview-img" />
          </div>
        </div>
      `;
    } else if (currentTemplate === 'focus') {
      layoutHtml = `
        <div class="layout-grid layout-half">
          <div class="grid-col">
            <blockquote class="article-quote">
              ${quoteVal}
              <cite class="quote-author">${authorVal}</cite>
            </blockquote>
          </div>
          <div class="grid-col">
            <p class="preview-text">${textVal}</p>
          </div>
        </div>
      `;
    } else if (currentTemplate === 'triptych') {
      layoutHtml = `
        <div class="layout-grid layout-three-cols" style="margin-bottom: 2rem;">
          <div class="grid-col">
            <img src="img/newspaper_whitespace_1777876504195.png" alt="Схема 1" class="preview-img" />
          </div>
          <div class="grid-col">
            <img src="img/newspaper_grid_1777876473624.png" alt="Схема 2" class="preview-img" />
          </div>
          <div class="grid-col">
            <img src="img/newspaper_typography_1777876489185.png" alt="Схема 3" class="preview-img" />
          </div>
        </div>
        <p class="preview-text-dropcap">${textVal}</p>
      `;
    } else if (currentTemplate === 'minimal') {
      layoutHtml = `
        <div class="layout-grid layout-sidebar">
          <div class="grid-col">
            <p class="preview-text-dropcap">${textVal}</p>
          </div>
          <div class="grid-col">
            <img src="${activeImage}" alt="Ілюстрація" class="preview-img img-portrait" style="aspect-ratio: 3/4; object-fit: cover;" />
          </div>
        </div>
      `;
    }

    dynamicLayoutArea.innerHTML = layoutHtml;

    // Apply drop cap styles to dynamically added classes
    const dropcapEl = document.querySelector('.preview-text-dropcap');
    if (dropcapEl) {
      const originalText = dropcapEl.textContent;
      if (originalText.length > 0) {
        const firstLetter = originalText.charAt(0);
        const restText = originalText.slice(1);
        
        // Wrap first letter in a styled dropcap span
        dropcapEl.innerHTML = `<span class="preview-dropcap-letter">${firstLetter}</span>${restText}`;
      }
    }

    // Update code output block
    updateCodeOutput(titleVal, quoteVal, authorVal, textVal);
  }

  // Generate Markdown and HTML representation
  function updateCodeOutput(title, quote, author, text) {
    let codeStr = '';

    codeStr += `---\n`;
    codeStr += `slug: "custom-article"\n`;
    codeStr += `title: "${title.replace(/"/g, '\\"')}"\n`;
    codeStr += `plainTitle: "${title.replace(/"/g, '\\"')}"\n`;
    if (currentTemplate !== 'triptych') {
      codeStr += `image: "${activeImage}"\n`;
    } else {
      codeStr += `image: "img/placeholder.jpg"\n`;
    }
    codeStr += `chapterId: "preface"\n`;
    codeStr += `---\n\n`;

    if (currentTemplate === 'lead') {
      codeStr += `<!-- Автоматичний макет 'Шпальта головної новини' -->\n`;
      codeStr += `<p>${text}</p>\n`;
      codeStr += `![Ілюстрація](${activeImage})\n`;
    } else if (currentTemplate === 'focus') {
      codeStr += `<!-- Автоматичний макет 'Редакційний фокус' -->\n`;
      codeStr += `<blockquote class="article-quote">\n`;
      codeStr += `  ${quote}\n`;
      codeStr += `  <cite class="quote-author">${author}</cite>\n`;
      codeStr += `</blockquote>\n`;
      codeStr += `<p>${text}</p>\n`;
    } else if (currentTemplate === 'triptych') {
      codeStr += `<!-- Автоматичний макет 'Триптих-Галерея' -->\n`;
      codeStr += `![Схема 1](img/newspaper_whitespace_1777876504195.png)\n`;
      codeStr += `![Схема 2](img/newspaper_grid_1777876473624.png)\n`;
      codeStr += `![Схема 3](img/newspaper_typography_1777876489185.png)\n\n`;
      codeStr += `<p>${text}</p>\n`;
    } else if (currentTemplate === 'minimal') {
      codeStr += `<!-- Автоматичний макет 'Сучасний мінімалізм' -->\n`;
      codeStr += `<p>${text}</p>\n`;
      codeStr += `![Ілюстрація](${activeImage})\n`;
    }

    codeOutput.textContent = codeStr;
  }

  // Initial render
  // Trigger click on Focus card to initialize contextual fields and back
  templateCards[0].click();
});

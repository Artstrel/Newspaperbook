function initScroll() {
  const chapterList = document.querySelector('.chapter-list') || document.querySelector('.subsection-list');
  const items = document.querySelectorAll('.chapter-item, .subsection-item');

  if (!chapterList || items.length === 0) return;

  const wrapper = chapterList.parentElement;
  let indicator = wrapper.querySelector('.scroll-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.classList.add('scroll-indicator');
    indicator.textContent = '|';
    wrapper.appendChild(indicator);
  }

  let targetScroll = chapterList.scrollTop;
  let currentScroll = targetScroll;
  let isAnimating = false;
  let snapTimeout;

  const getPhysicalMaxScroll = () => Math.max(0, chapterList.scrollHeight - chapterList.clientHeight);

  const getMaxScroll = () => {
    const physical = getPhysicalMaxScroll();
    if (physical > 0) return physical;

    return Math.max(0, (items.length - 1) * 100);
  };

  const updateActiveItemVisual = () => {
    const maxScroll = getMaxScroll();
    const progress = maxScroll > 0 ? currentScroll / maxScroll : 0;

    const listRect = chapterList.getBoundingClientRect();
    const firstItemRect = items[0].getBoundingClientRect();
    const ih = firstItemRect.height;
    const h = listRect.height;

    const relativeTop = (h - ih) * progress;
    if (indicator) {
      indicator.style.top = `${relativeTop}px`;
    }

    const checkPosition = listRect.top + relativeTop;

    let closestIndex = 0;
    let minDistance = Infinity;

    items.forEach((item, index) => {
      const itemRect = item.getBoundingClientRect();
      const distance = Math.abs(checkPosition - itemRect.top);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    items.forEach((item, index) => {
      if (index === closestIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  };

  const lerpScroll = () => {

    currentScroll += (targetScroll - currentScroll) * 0.08;


    chapterList.scrollTop = currentScroll;

    updateActiveItemVisual();


    if (Math.abs(targetScroll - currentScroll) > 0.5) {
      requestAnimationFrame(lerpScroll);
    } else {
      currentScroll = targetScroll;
      chapterList.scrollTop = currentScroll;
      updateActiveItemVisual();
      isAnimating = false;
    }
  };

  const snapToNearest = () => {
    const maxScroll = getMaxScroll();
    const progress = maxScroll > 0 ? currentScroll / maxScroll : 0;

    const listRect = chapterList.getBoundingClientRect();
    const checkPosition = listRect.top + listRect.height * progress;

    let closestIndex = 0;
    let minDistance = Infinity;

    items.forEach((item, index) => {
      const itemRect = item.getBoundingClientRect();
      const itemCheckPosition = itemRect.top + itemRect.height * progress;
      const distance = Math.abs(checkPosition - itemCheckPosition);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    const item = items[closestIndex];
    if (!item) return;

    let newTarget;
    if (maxScroll === 0) {
      newTarget = 0;
    } else {
      const itemRect = item.getBoundingClientRect();

      const originalItemTop = itemRect.top - listRect.top + chapterList.scrollTop;
      const itemHeight = itemRect.height;
      const listHeight = listRect.height;

      const physicalMaxScroll = getPhysicalMaxScroll();
      if (physicalMaxScroll > 0) {
        const denominator = (listHeight - itemHeight) / maxScroll + 1;
        newTarget = originalItemTop / denominator;
      } else {

        newTarget = (originalItemTop * maxScroll) / Math.max(1, (listHeight - itemHeight));
      }
    }

    targetScroll = Math.max(0, Math.min(newTarget, maxScroll));

    if (!isAnimating) {
      isAnimating = true;
      requestAnimationFrame(lerpScroll);
    }
  };

  window.addEventListener('wheel', (e) => {

    e.preventDefault();


    targetScroll += e.deltaY;
    targetScroll = Math.max(0, Math.min(targetScroll, getMaxScroll()));

    if (!isAnimating) {
      isAnimating = true;
      requestAnimationFrame(lerpScroll);
    }


    clearTimeout(snapTimeout);
    snapTimeout = setTimeout(() => {
      snapToNearest();
    }, 150);
  }, { passive: false });


  chapterList.addEventListener('scroll', () => {
    if (!isAnimating && getPhysicalMaxScroll() > 0) {
      currentScroll = targetScroll = chapterList.scrollTop;
      updateActiveItemVisual();

      clearTimeout(snapTimeout);
      snapTimeout = setTimeout(() => {
        snapToNearest();
      }, 150);
    }
  }, { passive: true });


  items.forEach((item, index) => {
    item.addEventListener('click', (e) => {
      const href = item.getAttribute('href');


      if (href && href !== '#') {
        return;
      }

      e.preventDefault();

      const maxScroll = getMaxScroll();
      let newTarget;
      if (maxScroll === 0) {
        newTarget = 0;
      } else {
        const listRect = chapterList.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const originalItemTop = itemRect.top - listRect.top + chapterList.scrollTop;

        const itemHeight = itemRect.height;
        const listHeight = listRect.height;

        const physicalMaxScroll = getPhysicalMaxScroll();
        if (physicalMaxScroll > 0) {
          const denominator = (listHeight - itemHeight) / maxScroll + 1;
          newTarget = originalItemTop / denominator;
        } else {
          newTarget = (originalItemTop * maxScroll) / Math.max(1, (listHeight - itemHeight));
        }
      }

      targetScroll = Math.max(0, Math.min(newTarget, maxScroll));

      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(lerpScroll);
      }
    });
  });


  updateActiveItemVisual();
}

document.addEventListener('DOMContentLoaded', initScroll);
window.addEventListener('cms:rendered', initScroll);

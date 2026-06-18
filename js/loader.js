(function() {

  const grid1 = `<svg class="loader-grid" viewBox="0 0 100 140" preserveAspectRatio="none">
    <path d="M0 0 h100 v140 h-100 Z M33.3 0 v140 M66.6 0 v140 M0 46.6 h100 M0 93.3 h100" stroke="currentColor" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>
  </svg>`;

  const grid2 = `<svg class="loader-grid" viewBox="0 0 100 140" preserveAspectRatio="none">
    <path d="M0 0 h100 v140 h-100 Z M0 0 L100 140 M100 0 L0 140 M50 0 v140 M0 70 h100 M0 0 L50 140 M100 0 L50 140 M0 140 L50 0 M100 140 L50 0" stroke="currentColor" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>
  </svg>`;

  const grid3 = `<svg class="loader-grid" viewBox="0 0 100 140" preserveAspectRatio="none">
    <path d="M0 0 h100 v140 h-100 Z M0 0 L100 140 M100 0 L0 140 M0 0 L50 140 M100 0 L50 140" stroke="currentColor" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>
    <rect x="22.2" y="15.5" width="55.5" height="93.3" stroke="currentColor" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/>
  </svg>`;


  const loaderEl = document.createElement('div');
  loaderEl.id = 'site-loader';
  loaderEl.innerHTML = `
    <div class="loader-svg-container">
      <div class="grid-layer grid-1">${grid1}</div>
      <div class="grid-layer grid-2">${grid2}</div>
      <div class="grid-layer grid-3">${grid3}</div>
    </div>
    <div id="loader-percentage">0%</div>
  `;


  document.documentElement.appendChild(loaderEl);

  const initLoader = () => {
    const isFirstVisit = !sessionStorage.getItem('siteLoaded');
    const minLoadTime = isFirstVisit ? 1800 : 0;

    let startTime = null;
    let currentProgress = isFirstVisit ? 0 : 1;
    const pctEl = document.getElementById('loader-percentage');
    const grids = document.querySelectorAll('.grid-layer');

    let isLoaded = false;
    let isWindowLoaded = document.readyState === 'complete';
    let isCmsLoaded = false;


    if (!isFirstVisit) {
      pctEl.textContent = '100%';
      grids[0].style.opacity = 0;
      grids[1].style.opacity = 0;
      grids[2].style.opacity = 1;
    }

    document.addEventListener('DOMContentLoaded', () => {
      if (!document.documentElement.hasAttribute('data-cms-page') &&
          (!document.body || !document.body.hasAttribute('data-cms-page'))) {
        isCmsLoaded = true;
        checkLoaded();
      }
    });

    const checkLoaded = () => {
      if (isWindowLoaded && isCmsLoaded) {
        isLoaded = true;
      }
    };
    checkLoaded();

    window.addEventListener('load', () => {
      isWindowLoaded = true;
      checkLoaded();
    });
    window.addEventListener('cms:loaded', () => {
      isCmsLoaded = true;
      checkLoaded();
    });

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      if (!isFirstVisit) {

        if (isLoaded) {
          setTimeout(() => {
            loaderEl.classList.add('hide');
          }, 100);
          return;
        }
        requestAnimationFrame(animate);
        return;
      }


      const timeProgress = Math.min(elapsed / minLoadTime, 1);
      let targetProgress = 0;

      if (isLoaded && elapsed >= minLoadTime) {
        targetProgress = 1;
      } else {
        targetProgress = 0.9 * timeProgress;
      }

      currentProgress += (targetProgress - currentProgress) * 0.1;

      if (isLoaded && elapsed >= minLoadTime && currentProgress > 0.99) {
        currentProgress = 1;
      }


      pctEl.textContent = Math.floor(currentProgress * 100) + '%';


      if (currentProgress < 0.33) {
        grids[0].style.opacity = 1;
        grids[1].style.opacity = 0;
        grids[2].style.opacity = 0;
      } else if (currentProgress < 0.66) {
        grids[0].style.opacity = 0;
        grids[1].style.opacity = 1;
        grids[2].style.opacity = 0;
      } else {
        grids[0].style.opacity = 0;
        grids[1].style.opacity = 0;
        grids[2].style.opacity = 1;
      }

      if (currentProgress < 1) {
        requestAnimationFrame(animate);
      } else {

        sessionStorage.setItem('siteLoaded', 'true');
        setTimeout(() => {
          loaderEl.classList.add('hide');
        }, 100);
      }
    };

    requestAnimationFrame(animate);
  };


  initLoader();


  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && link.target !== '_blank' && link.getAttribute('href') !== '#') {
      const rawHref = link.getAttribute('href');


      if (rawHref && rawHref.charAt(0) === '#') return;


      const target = new URL(link.href, window.location.href);
      if (target.hash &&
          target.pathname === window.location.pathname &&
          target.search === window.location.search) {
        return;
      }

      const isInternal = link.href.startsWith(window.location.origin) || !link.href.startsWith('http');
      if (isInternal) {
        e.preventDefault();
        loaderEl.classList.remove('hide');
        loaderEl.classList.add('fade-in');


        const pctEl = document.getElementById('loader-percentage');
        pctEl.textContent = '0%';


        const grids = document.querySelectorAll('.grid-layer');
        if (grids.length >= 3) {
          grids[0].style.opacity = 1;
          grids[1].style.opacity = 0;
          grids[2].style.opacity = 0;
        }

        let p = 0;
        const intv = setInterval(() => {
          p += 5;
          if(p <= 100) {
            pctEl.textContent = p + '%';


            if (p < 33) {
              grids[0].style.opacity = 1;
              grids[1].style.opacity = 0;
              grids[2].style.opacity = 0;
            } else if (p < 66) {
              grids[0].style.opacity = 0;
              grids[1].style.opacity = 1;
              grids[2].style.opacity = 0;
            } else {
              grids[0].style.opacity = 0;
              grids[1].style.opacity = 0;
              grids[2].style.opacity = 1;
            }
          }
        }, 30);

        setTimeout(() => {
          clearInterval(intv);
          window.location.href = link.href;
        }, 600);
      }
    }
  });

})();

(() => {
  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  ready(() => {
    const header = document.querySelector('.site-header');
    const inner = header?.querySelector('.site-header__inner');
    const nav = header?.querySelector('.site-nav');
    const brand = header?.querySelector('.brand');

    if (!header || !inner || !nav || !brand) return;

    if (!nav.id) {
      nav.id = 'siteNav';
    }

    let toggle = inner.querySelector('.mobile-menu-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.className = 'mobile-menu-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-controls', nav.id);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Открыть меню');
      toggle.innerHTML = '<span></span><span></span><span></span>';
      inner.insertBefore(toggle, nav);
    }

    const closeMenu = () => {
      document.body.classList.remove('mobile-menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Открыть меню');
    };

    const openMenu = () => {
      document.body.classList.add('mobile-menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Закрыть меню');
    };

    toggle.addEventListener('click', () => {
      if (document.body.classList.contains('mobile-menu-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    document.addEventListener('click', (event) => {
      if (!document.body.classList.contains('mobile-menu-open')) return;
      if (header.contains(event.target)) return;
      closeMenu();
    });
  });
})();

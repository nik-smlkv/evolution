export function initializeHeaderNavigation() {
  const header = document.querySelector('header');
  const body = header.querySelector('.header__body');
  const menu = header.querySelector('.header__menu');
  const actions = header.querySelector('.header-block');
  const logo = header.querySelector('.header__logo');
  const primary = header.querySelector('.header__nav_list');
  const overflow = header.querySelector('.header__overflow_list');
  const burger = header.querySelector('.header__burger');
  const items = Array.from(primary.children);
  let frame;

  const close = () => {
    menu.classList.remove('active');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    overflow.inert = true;
    document.body.classList.remove('header-menu-open');
    header.querySelectorAll('[data-house-menu]').forEach((houseMenu) => {
      houseMenu.dataset.open = 'false';
      houseMenu.querySelector('.house-menu__toggle').setAttribute('aria-expanded', 'false');
    });
  };

  const fitNavigation = () => {
    frame = null;
    const focused = document.activeElement;
    const focusedItem = items.find((item) => item.contains(focused));
    const houseMenu = header.querySelector('[data-house-menu]');
    const houseMenuParent = houseMenu?.parentElement;
    items.forEach((item, index) => {
      if (primary.children[index] !== item) primary.insertBefore(item, primary.children[index] || null);
    });
    header.classList.remove('header-has-overflow');
    header.dataset.visibleLinks = String(items.length);

    const widths = items.map((item) => item.getBoundingClientRect().width);
    const listGap = parseFloat(getComputedStyle(primary).columnGap) || 0;
    const bodyStyle = getComputedStyle(body);
    const menuGap = parseFloat(getComputedStyle(menu).columnGap) || 0;
    const availableWidth = () => body.clientWidth
      - parseFloat(bodyStyle.paddingLeft) - parseFloat(bodyStyle.paddingRight)
      - actions.getBoundingClientRect().width - (parseFloat(bodyStyle.columnGap) || 0)
      - logo.getBoundingClientRect().width - menuGap;
    const requiredWidth = (count) => widths.slice(0, count).reduce((sum, width) => sum + width, 0)
      + Math.max(0, count - 1) * listGap;

    let visible = items.length;
    if (matchMedia('(max-width: 700px)').matches || requiredWidth(visible) > availableWidth()) {
      header.classList.add('header-has-overflow');
      if (matchMedia('(max-width: 700px)').matches) visible = 0;
      else while (visible > 0 && requiredWidth(visible) > availableWidth()) visible -= 1;
    }
    items.slice(visible).forEach((item) => overflow.append(item));
    if (houseMenu && houseMenu.parentElement !== houseMenuParent) {
      houseMenu.dataset.open = 'false';
      houseMenu.querySelector('.house-menu__toggle').setAttribute('aria-expanded', 'false');
    }
    header.dataset.visibleLinks = String(visible);
    header.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
    if (visible === items.length) close();

    if (focusedItem && document.activeElement !== focused) {
      if (overflow.contains(focused) && overflow.inert) burger.focus({ preventScroll: true });
      else focused.focus({ preventScroll: true });
    }
  };

  const scheduleFit = () => {
    if (!frame) frame = requestAnimationFrame(fitNavigation);
  };

  burger.addEventListener('click', () => {
    if (menu.classList.contains('active')) close();
    else {
      menu.classList.add('active');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
      overflow.inert = false;
      document.body.classList.add('header-menu-open');
      overflow.querySelector('a, button')?.focus({ preventScroll: true });
    }
  });
  menu.addEventListener('click', (event) => {
    if (event.target.closest('.menu__item_link, .house-menu__list a')) close();
  });
  header.querySelector('.js-scroll-form')?.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('active')) {
      close();
      burger.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (menu.classList.contains('active') && !menu.contains(event.target) && !actions.contains(event.target)) close();
  });
  header.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', scheduleFit));
  const resizeObserver = new ResizeObserver(scheduleFit);
  [body, actions, logo].forEach((element) => resizeObserver.observe(element));
  window.addEventListener('resize', scheduleFit);
  document.fonts.ready.then(scheduleFit);
  document.fonts.addEventListener('loadingdone', scheduleFit);
  fitNavigation();
  return close;
}

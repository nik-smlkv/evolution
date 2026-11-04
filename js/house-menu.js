document.querySelectorAll('[data-house-menu]').forEach((menu) => {
  const toggle = menu.querySelector('.house-menu__toggle');

  const setOpen = (isOpen) => {
    menu.dataset.open = String(isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  };

  toggle.addEventListener('click', () => {
    setOpen(menu.dataset.open !== 'true');
  });

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.dataset.open === 'true') {
      event.stopPropagation();
      setOpen(false);
      toggle.focus();
    }
  });

  menu.querySelectorAll('.house-menu__list a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) setOpen(false);
  });
});

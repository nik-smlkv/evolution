document.querySelectorAll('[data-house-menu]').forEach((menu) => {
  const toggle = menu.querySelector('.house-menu__toggle');

  const setOpen = (isOpen) => {
    menu.dataset.open = String(isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  };

  toggle.addEventListener('click', () => {
    setOpen(menu.dataset.open !== 'true');
  });

  menu.addEventListener('mouseleave', () => {
    if (window.matchMedia('(hover: hover)').matches) setOpen(false);
  });

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) setOpen(false);
  });
});

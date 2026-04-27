document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('menu-icon');

  if (btn && menu && icon) {
    btn.addEventListener('click', () => {
      menu.classList.toggle('hidden');
      icon.textContent = menu.classList.contains('hidden') ? 'menu' : 'close';
    });

    const menuLinks = menu.querySelectorAll('a');
    menuLinks.forEach((link) => {
      link.addEventListener('click', () => {
        menu.classList.add('hidden');
        icon.textContent = 'menu';
      });
    });
  }
});

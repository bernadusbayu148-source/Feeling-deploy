document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('menu-icon');

  if (button && menu && icon) {
    button.addEventListener('click', () => {
      menu.classList.toggle('hidden');
      icon.textContent = menu.classList.contains('hidden')
        ? 'menu'
        : 'close';
    });
  }
});

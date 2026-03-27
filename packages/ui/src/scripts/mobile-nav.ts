/**
 * Mobile navigation toggle — shared by Header and MobileNav.
 * Opens/closes the mobile nav overlay and manages body scroll lock.
 */
export function initMobileNav(): void {
  const menuButton = document.getElementById('mobile-menu-button');
  const mobileNav = document.getElementById('mobile-nav');
  const closeButton = document.getElementById('mobile-menu-close');

  if (!menuButton || !mobileNav) return;

  const open = () => {
    mobileNav.classList.remove('hidden');
    menuButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');
  };

  const close = () => {
    mobileNav.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('overflow-hidden');
  };

  // Toggle on hamburger click
  menuButton.addEventListener('click', () => {
    const isExpanded = menuButton.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      close();
    } else {
      open();
    }
  });

  // Close on X button click
  if (closeButton) {
    closeButton.addEventListener('click', close);
  }

  // Close on nav link click
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', close);
  });
}

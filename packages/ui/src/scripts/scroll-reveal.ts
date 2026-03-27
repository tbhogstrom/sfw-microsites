/**
 * Lightweight scroll-triggered fade-in using IntersectionObserver.
 * Add `data-reveal` to any element to animate it in when scrolled into view.
 */
export function initScrollReveal(): void {
  const elements = document.querySelectorAll('[data-reveal]');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
  );

  elements.forEach((el) => observer.observe(el));
}

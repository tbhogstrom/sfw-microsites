/**
 * Initialize Swiper for testimonial slider.
 * Dynamically imports Swiper to avoid SSR issues.
 */
export function initTestimonialSlider(
  sliderId: string,
  autoplay: boolean,
  autoplayDelay: number,
): void {
  Promise.all([
    import('swiper/css'),
    import('swiper/css/navigation'),
    import('swiper/css/pagination'),
    import('swiper'),
  ]).then(([_css, _nav, _pag, { default: Swiper, Navigation, Pagination, Autoplay }]) => {
    new Swiper(`.${sliderId}`, {
      modules: [Navigation, Pagination, Autoplay],
      slidesPerView: 1,
      spaceBetween: 30,
      loop: true,
      autoplay: autoplay ? { delay: autoplayDelay, disableOnInteraction: false } : false,
      navigation: {
        nextEl: `.swiper-button-next-${sliderId}`,
        prevEl: `.swiper-button-prev-${sliderId}`,
      },
      pagination: {
        el: `.swiper-pagination-${sliderId}`,
        clickable: true,
      },
      breakpoints: {
        640: { slidesPerView: 1 },
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      },
    });
  });
}

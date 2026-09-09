const header = document.querySelector('.header');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
const navLinks = document.querySelectorAll('.nav a');

const setMenu = (open) => {
  menuToggle?.setAttribute('aria-expanded', String(open));
  menuToggle?.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  nav?.classList.toggle('is-open', open);
  document.body.classList.toggle('menu-open', open);
};

menuToggle?.addEventListener('click', () => {
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
});

navLinks.forEach((link) => link.addEventListener('click', () => setMenu(false)));

let lastStickyState = false;
const syncHeader = () => {
  const sticky = window.scrollY > 120;
  if (sticky !== lastStickyState) {
    header?.classList.toggle('is-sticky', sticky);
    lastStickyState = sticky;
  }
};
window.addEventListener('scroll', syncHeader, { passive: true });
syncHeader();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -45px' });
  revealItems.forEach((item) => revealObserver.observe(item));
}

const equipmentRail = document.querySelector('.equipment__rail');
const scrollEquipment = (direction) => {
  if (!equipmentRail) return;
  const card = equipmentRail.querySelector('.machine-card');
  const amount = card ? card.getBoundingClientRect().width + 14 : 360;
  equipmentRail.scrollBy({ left: direction * amount, behavior: 'smooth' });
};
document.querySelector('.slider-prev')?.addEventListener('click', () => scrollEquipment(-1));
document.querySelector('.slider-next')?.addEventListener('click', () => scrollEquipment(1));

const form = document.querySelector('.booking-form');
const toast = document.querySelector('.toast');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  toast?.classList.add('is-visible');
  form.reset();
  window.setTimeout(() => toast?.classList.remove('is-visible'), 3800);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 800) setMenu(false);
});

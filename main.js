// Nav hide on scroll
const nav = document.getElementById('nav');
let lastY = window.scrollY;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  nav.classList.toggle('hidden', y > lastY && y > 80);
  lastY = y;
}, { passive: true });

// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.blur-fade').forEach(el => observer.observe(el));

// Live local time (ET — West Lafayette, IN)
function updateTime() {
  const el = document.getElementById('local-time');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Indiana/Indianapolis',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
updateTime();
setInterval(updateTime, 1000);

// RAG panel toggle
const ragToggle = document.getElementById('rag-toggle');
const ragPanel  = document.getElementById('rag-panel');
const ragClose  = document.getElementById('rag-close');

ragToggle.addEventListener('click', () => ragPanel.classList.toggle('open'));
ragClose.addEventListener('click',  () => ragPanel.classList.remove('open'));

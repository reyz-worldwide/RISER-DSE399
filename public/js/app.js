document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[type="date"]').forEach(i => { if (!i.value) i.value = new Date().toISOString().slice(0, 10); });
});

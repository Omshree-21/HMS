// Simple IntersectionObserver to reveal elements smoothly on scroll
(function(){
  const els = [].slice.call(document.querySelectorAll('.reveal'));
  if (!('IntersectionObserver' in window) || els.length === 0) {
    els.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  els.forEach(el => io.observe(el));
})();

// Simple modal controller
(function(){
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;
  const modal = overlay.querySelector('.modal');
  function openModal() { overlay.classList.add('active'); }
  function closeModal() { overlay.classList.remove('active'); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-modal]');
    if (openBtn) {
      const type = openBtn.getAttribute('data-modal-type');
      if (type === 'status') {
        const apptId = openBtn.getAttribute('data-appt-id');
        const current = openBtn.getAttribute('data-current-status') || 'pending';
        const form = modal.querySelector('form');
        const select = modal.querySelector('select[name="status"]');
        const diag = modal.querySelector('textarea[name="diagnosis"]');
        const comment = modal.querySelector('textarea[name="doctor_comment"]');
        form.action = `/appointments/${apptId}/status`;
        select.value = current;
        if (diag) diag.value = openBtn.getAttribute('data-current-diagnosis') || '';
        if (comment) comment.value = openBtn.getAttribute('data-current-comment') || '';
        modal.querySelector('.modal-header').textContent = 'Update Appointment Status';
        modal.querySelector('[data-patient-info]')?.classList.add('hidden');
        modal.querySelector('[data-status-form]')?.classList.remove('hidden');
        openModal();
      }
      if (type === 'patient') {
        const name = openBtn.getAttribute('data-patient-name') || '';
        const email = openBtn.getAttribute('data-patient-email') || '';
        const concern = openBtn.getAttribute('data-concern') || '';
        modal.querySelector('.modal-header').textContent = 'Patient Details';
        const info = modal.querySelector('[data-patient-info]');
        info.querySelector('[data-name]').textContent = name;
        info.querySelector('[data-email]').textContent = email;
        info.querySelector('[data-concern]').textContent = concern;
        info.classList.remove('hidden');
        modal.querySelector('[data-status-form]')?.classList.add('hidden');
        openModal();
      }
    }
    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) closeModal();
  });
})();

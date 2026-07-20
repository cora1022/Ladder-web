const ads = { enabled: false, client: 'ca-pub-6044197403684738', slots: { top: '', middle: '', bottom: '' } };
if (ads.enabled && ads.client && Object.values(ads.slots).some(Boolean)) {
  document.querySelectorAll('[data-ad-position]').forEach((container) => {
    const slot = ads.slots[container.dataset.adPosition]; if (!slot) return;
    const unit = document.createElement('ins'); unit.className = 'adsbygoogle'; unit.style.display = 'block'; unit.dataset.adClient = ads.client; unit.dataset.adSlot = slot; unit.dataset.adFormat = 'auto'; unit.dataset.fullWidthResponsive = 'true';
    container.appendChild(unit); container.hidden = false; try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* 다음 로드에서 재시도 */ }
  });
}

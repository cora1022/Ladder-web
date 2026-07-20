const measurementId = 'G-PHEXQ6C1M0';
const consentKey = 'cora-ladder:analytics-consent:v1';
const banner = document.querySelector('[data-consent]');
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
function loadAnalytics() {
  if (document.querySelector('[data-google-tag]')) return;
  window.gtag('consent', 'update', { analytics_storage: 'granted' }); window.gtag('js', new Date()); window.gtag('config', measurementId, { anonymize_ip: true });
  const script = document.createElement('script'); script.async = true; script.dataset.googleTag = measurementId; script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`; document.head.appendChild(script);
}
function choose(value) { try { localStorage.setItem(consentKey, value); } catch { /* 저장 없이 사용 가능 */ } if (banner) banner.hidden = true; if (value === 'granted') loadAnalytics(); }
let saved = null; try { saved = localStorage.getItem(consentKey); } catch { /* 통계 없이 계속 */ }
if (saved === 'granted') loadAnalytics(); else if (saved !== 'denied' && banner) banner.hidden = false;
document.querySelector('[data-consent-accept]')?.addEventListener('click', () => choose('granted'));
document.querySelector('[data-consent-reject]')?.addEventListener('click', () => choose('denied'));
document.querySelector('[data-year]')?.replaceChildren(String(new Date().getFullYear()));

// Smart EPS Service Worker - Network First + Update Notification
// v2.3: يحفظ ملفات التطبيق ومكتبات Excel/PDF والخطوط للعمل دون إنترنت،
//       ولا يحفظ طلبات المزامنة وتسجيل الدخول (Firebase/Google APIs) حتى لا تتضخم الذاكرة
const CACHE = 'smart-eps-v62';   // الاسم نفسه عمداً: حتى لا تُمسح المكتبات المحفوظة حالياً
const APP_VERSION = '2.10.6';

// المواقع الخارجية المسموح بحفظها (مكتبات وخطوط فقط)
const CACHE_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'www.gstatic.com',      // مكتبات Firebase نفسها (ملفات JS)
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
  // Notify all open clients of update
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({type:'UPDATE_AVAILABLE',version:APP_VERSION}));
  });
});

function shouldCache(req, resp){
  let u;
  try{ u = new URL(req.url); }catch(e){ return false; }
  if(u.protocol !== 'http:' && u.protocol !== 'https:') return false;   // chrome-extension:// وغيرها
  const same = u.origin === self.location.origin;
  if(!same && CACHE_HOSTS.indexOf(u.hostname) === -1) return false;    // Firestore/Auth/googleapis وغيرها: لا تُحفظ
  if(!resp) return false;
  if(resp.status === 206) return false;                                 // استجابات جزئية لا تُحفظ
  if(resp.type === 'opaque') return !same;                              // مكتبات CDN (no-cors) مسموحة
  return resp.ok;
}

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(resp => {
      if(shouldCache(e.request, resp)){
        const clone = resp.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone)).catch(()=>{});
      }
      return resp;
    }).catch(() => caches.match(e.request))
  );
});

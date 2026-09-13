self.__BUILD_ASSETS__ = [] // ← ビルド時に置換される

// Service Worker。
// 目的は2つ:
//  1. Chromeにインストール可能なPWAとして認識させる(無いと「ショートカット」扱いになり、
//     ホーム画面のアイコンがmanifestのものではなく自動生成のタイルになってしまう)
//  2. 電車の中など通信のない場所でも学習を続けられるようにする
//
// キャッシュ戦略は「壊れても復帰できること」を優先している。
//  - 画面遷移(navigate)はネットワーク優先。新しいデプロイが即反映され、
//    オフラインのときだけキャッシュしたindex.htmlを返す
//  - /assets/ の中身はViteがファイル名にハッシュを付けるので中身が変わればURLも変わる。
//    よってキャッシュ優先で安全
//  - それ以外は素通し

const VERSION = 'v3'
const CACHE = `devanagari-quest-${VERSION}`

// ビルド時に vite.config.js のプラグインが実ファイル名(ハッシュ付き)を差し込む。
// ここを事前キャッシュしないと、初回訪問後すぐオフラインにしたときに
// JS/CSSが無くて白画面になる。
const BUILD_ASSETS = self.__BUILD_ASSETS__ || []

const SHELL = [
  './',
  './index.html',
  './favicon-32.png?v=3',
  './favicon-16.png?v=3',
  './icon-192.png?v=3',
  './icon-512.png?v=3',
  './icon-maskable-192.png?v=3',
  './icon-maskable-512.png?v=3',
  './apple-touch-icon.png?v=3',
  './favicon.svg?v=3',
  './site.webmanifest?v=3',
  ...BUILD_ASSETS,
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // 1つでも失敗すると全部入らないので個別に入れる
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

/**
 * キャッシュ照合。
 * ignoreVary が必須。アセットは Vary: Origin 付きで配信される一方、
 * 事前キャッシュ時の fetch には Origin ヘッダが無いため、
 * 既定の照合だと <script crossorigin> からの要求と一致せず必ず miss する。
 */
const fromCache = (req) => caches.match(req, { ignoreVary: true })

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // フォントなど外部は素通し

  // 画面遷移: ネットワーク優先(新しいデプロイを取りこぼさないため)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy))
          return res
        })
        .catch(() => fromCache('./index.html').then((r) => r || Response.error()))
    )
    return
  }

  // ハッシュ付きアセットとアイコン: キャッシュ優先
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest|mp3|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      fromCache(request).then((hit) => {
        if (hit) return hit
        return fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(request, copy))
            }
            return res
          })
          .catch(() => Response.error())
      })
    )
  }
})

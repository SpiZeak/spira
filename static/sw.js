// MUST BUMP THIS VERSION ON EVERY DEPLOY (e.g., spira-v2, spira-v3)
// Otherwise, old cachebusted assets will bloat the user's storage forever.
const CACHE_NAME = "spira-v2";

const PRECACHE_URLS = ["/", "/vaxter/", "/guider/", "/om/"];

// ---------------------------------------------------------------------------
// Install & Activate (Unchanged)
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
			),
	);
	self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
	const { request } = event;

	if (request.method !== "GET") return;

	const url = new URL(request.url);

	// Handle External Origins
	if (url.origin !== self.location.origin) {
		// Google Fonts
		if (url.hostname.includes("fonts.g")) {
			event.respondWith(staleWhileRevalidate(request));
			return;
		}
		// Unsplash Images (Cache First for offline support)
		if (url.hostname.includes("images.unsplash.com")) {
			event.respondWith(cacheFirst(request));
			return;
		}
		return;
	}

	// HTML navigation – network-first so content stays fresh
	if (request.headers.get("Accept")?.includes("text/html")) {
		event.respondWith(networkFirst(request));
		return;
	}

	// Static assets (CSS, JS, local images, icons, manifests) – cache-first
	event.respondWith(cacheFirst(request));
});

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;

	const response = await fetch(request);

	// Only cache successful responses (or opaque cross-origin responses from Unsplash)
	// response.type === 'opaque' happens when fetching cross-origin without CORS
	if (response.ok || response.type === "opaque") {
		const cache = await caches.open(CACHE_NAME);
		cache.put(request, response.clone());
	}
	return response;
}

async function networkFirst(request) {
	const cache = await caches.open(CACHE_NAME);
	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		const cached = await cache.match(request);
		if (cached) return cached;
		const home = await cache.match("/");
		return home ?? new Response("Offline", { status: 503, statusText: "Service Unavailable" });
	}
}

async function staleWhileRevalidate(request) {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(request);

	const networkFetch = fetch(request).then((response) => {
		if (response.ok) cache.put(request, response.clone());
		return response;
	});

	return cached ?? networkFetch;
}

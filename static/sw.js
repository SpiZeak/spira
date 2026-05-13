const CACHE_NAME = "spira-v1";

const PRECACHE_URLS = ["/", "/vaxter/", "/guider/", "/om/"];

// ---------------------------------------------------------------------------
// Install – precache key pages
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
	self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate – remove stale caches
// ---------------------------------------------------------------------------
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

	// Only handle GET requests
	if (request.method !== "GET") return;

	const url = new URL(request.url);

	// External origins (e.g. Google Fonts) – stale-while-revalidate
	if (url.origin !== self.location.origin) {
		if (url.hostname.includes("fonts.g")) {
			event.respondWith(staleWhileRevalidate(request));
		}
		return;
	}

	// HTML navigation – network-first so content stays fresh
	if (request.headers.get("Accept")?.includes("text/html")) {
		event.respondWith(networkFirst(request));
		return;
	}

	// Static assets (CSS, JS, images, icons, manifests) – cache-first
	event.respondWith(cacheFirst(request));
});

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) {
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
		// Fall back to the cached home page for offline navigation
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

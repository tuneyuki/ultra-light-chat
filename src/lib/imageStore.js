const DB_NAME = 'ulc-images';
const STORE_NAME = 'images';
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/**
 * Get all records sorted by createdAt ascending (oldest first).
 * @returns {Promise<Array<{ id: string, blob: Blob, size: number, createdAt: number }>>}
 */
async function getAllRecords() {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const req = store.getAll();
		req.onsuccess = () => {
			const records = /** @type {Array<{ id: string, blob: Blob, size: number, createdAt: number }>} */ (req.result);
			records.sort((a, b) => a.createdAt - b.createdAt);
			resolve(records);
		};
		req.onerror = () => reject(req.error);
	});
}

/**
 * Save an image blob to IndexedDB. Evicts oldest entries if total exceeds 50MB.
 * @param {string} id
 * @param {Blob} blob
 */
export async function saveImage(id, blob) {
	const size = blob.size;
	const records = await getAllRecords();

	let total = records.reduce((sum, r) => sum + r.size, 0) + size;
	const toDelete = [];

	let i = 0;
	while (total > MAX_BYTES && i < records.length) {
		toDelete.push(records[i].id);
		total -= records[i].size;
		i++;
	}

	const db = await openDB();
	const tx = db.transaction(STORE_NAME, 'readwrite');
	const store = tx.objectStore(STORE_NAME);

	for (const delId of toDelete) {
		store.delete(delId);
	}

	store.put({ id, blob, size, createdAt: Date.now() });

	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve(undefined);
		tx.onerror = () => reject(tx.error);
	});
}

/**
 * Load an image by ID and return an Object URL.
 * @param {string} id
 * @returns {Promise<string | null>}
 */
export async function loadImage(id) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const req = store.get(id);
		req.onsuccess = () => {
			const record = req.result;
			if (record && record.blob) {
				resolve(URL.createObjectURL(record.blob));
			} else {
				resolve(null);
			}
		};
		req.onerror = () => reject(req.error);
	});
}

/**
 * Delete images by IDs.
 * @param {string[]} ids
 */
export async function deleteImages(ids) {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, 'readwrite');
	const store = tx.objectStore(STORE_NAME);
	for (const id of ids) {
		store.delete(id);
	}
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve(undefined);
		tx.onerror = () => reject(tx.error);
	});
}

/**
 * Delete all images.
 */
export async function deleteAllImages() {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, 'readwrite');
	const store = tx.objectStore(STORE_NAME);
	store.clear();
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve(undefined);
		tx.onerror = () => reject(tx.error);
	});
}

/**
 * Get current total storage usage in bytes.
 * @returns {Promise<number>}
 */
export async function getStorageUsage() {
	const records = await getAllRecords();
	return records.reduce((sum, r) => sum + r.size, 0);
}

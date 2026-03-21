import type { Stroke } from '../types';
import type { TextElement } from '../components/TextTool';
import type { ImageElement } from '../components/ImageTool';

export interface NoteMetadata {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    type?: 'note' | 'notebook';
    coverColor?: string;
}

export interface PageData {
    strokes: Stroke[];
    textElements: TextElement[];
    imageElements: ImageElement[];
    pageSettings?: {
        pageSize: string;
        pagePattern: string;
        pageColor: string;
    };
}

export interface NoteData {
    pages: PageData[];
    currentPageIndex?: number;
    pageSettings: {
        pageSize: string;
        pagePattern: string;
        pageColor: string;
    };
    // Legacy fields for migration
    strokes?: Stroke[];
    textElements?: TextElement[];
    imageElements?: ImageElement[];
}

const DB_NAME = 'TNotesDB';
const DB_VERSION = 1;
const STORE_METADATA = 'metadata';
const STORE_CONTENT = 'content';

class Storage {
    private db: IDBDatabase | null = null;

    private async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_METADATA)) {
                    db.createObjectStore(STORE_METADATA, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_CONTENT)) {
                    db.createObjectStore(STORE_CONTENT, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getAllNotes(): Promise<NoteMetadata[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_METADATA, 'readonly');
            const store = transaction.objectStore(STORE_METADATA);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt - a.updatedAt));
            request.onerror = () => reject(request.error);
        });
    }

    async getNoteContent(id: string): Promise<NoteData | null> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_CONTENT, 'readonly');
            const store = transaction.objectStore(STORE_CONTENT);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result?.data || null);
            request.onerror = () => reject(request.error);
        });
    }

    async saveNote(id: string, metadata: Partial<NoteMetadata>, data: NoteData): Promise<void> {
        const db = await this.init();
        const now = Date.now();

        // 1. Save Content
        const contentPromise = new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_CONTENT, 'readwrite');
            const store = transaction.objectStore(STORE_CONTENT);
            const request = store.put({ id, data });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        // 2. Save Metadata
        const metaPromise = new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_METADATA, 'readwrite');
            const store = transaction.objectStore(STORE_METADATA);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const existing = getRequest.result || { id, createdAt: now, title: 'Yeni Not' };
                const updated = {
                    ...existing,
                    ...metadata,
                    updatedAt: now
                };
                store.put(updated);
            };
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });

        await Promise.all([contentPromise, metaPromise]);
    }

    async deleteNote(id: string): Promise<void> {
        const db = await this.init();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([STORE_METADATA, STORE_CONTENT], 'readwrite');
            transaction.objectStore(STORE_METADATA).delete(id);
            transaction.objectStore(STORE_CONTENT).delete(id);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                console.error('Delete note failed:', transaction.error);
                reject(transaction.error);
            };
        });
    }

    async requestPersistence(): Promise<boolean> {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const isPersisted = await navigator.storage.persist();
                console.log(`Storage persistence ${isPersisted ? 'granted' : 'denied'}`);
                return isPersisted;
            } catch (err) {
                console.error('Persistence request failed:', err);
                return false;
            }
        }
        return false;
    }
}

export const storage = new Storage();

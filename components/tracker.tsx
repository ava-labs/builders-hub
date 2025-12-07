"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

interface IDBRequestEvent extends Event {
  target: IDBRequest & EventTarget;
}

const IndexedDBComponent: React.FC = () => {
  const currentPath = usePathname();

  useEffect(() => {
    const request = indexedDB.open("PathDatabase", 1);

    request.onerror = function (event: Event) {
      // Database error - silently fail
    };

    request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
      const db = (event.target as IDBOpenDBRequest).result as IDBDatabase;
      const objectStore = db.createObjectStore("paths", { keyPath: "id", autoIncrement: true });
      objectStore.createIndex("path", "path", { unique: false });
    };

    request.onsuccess = function (event: Event) {
      const db = (event.target as IDBOpenDBRequest).result as IDBDatabase;
      const transaction = db.transaction(["paths"], "readwrite");
      const objectStore = transaction.objectStore("paths");
      const index = objectStore.index("path");

      const getRequest = index.get(currentPath);

      getRequest.onsuccess = function (event: Event) {
        const result = (event.target as IDBRequest).result;
        if (result) {
          // Path already exists in Academy DB
        } else {
          const addRequest = objectStore.add({ path: currentPath });

          addRequest.onsuccess = function () {
            // Path has been added to Academy DB
          };

          addRequest.onerror = function (event: Event) {
            // Error adding path - silently fail
          };
        }
      };

      getRequest.onerror = function (event: Event) {
        // Error checking path - silently fail
      };

      const getAllRequest = objectStore.getAll();

      getAllRequest.onsuccess = function (event: Event) {
        // We no longer render checkmarks in the sidebar; this hook is kept
        // only for potential future tracking logic.
        const _paths = (event.target as IDBRequest).result as { path: string }[];
      };

      getAllRequest.onerror = function (event: Event) {
        // Error retrieving all paths - silently fail
      };
    };
  }, [currentPath]);

  return null;
};

export default IndexedDBComponent;

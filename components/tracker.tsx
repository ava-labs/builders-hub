'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const IndexedDBComponent: React.FC = () => {
  const currentPath = usePathname();

  useEffect(() => {
    const request = indexedDB.open("PathDatabase", 1);

    request.onerror = function (event: any) {
      console.error("Database error:", event.target.errorCode);
    };

    request.onupgradeneeded = function (event: any) {
      const db = event.target.result as IDBDatabase;
      const objectStore = db.createObjectStore("paths", { keyPath: "id", autoIncrement: true });
      objectStore.createIndex("path", "path", { unique: false });
    };

    request.onsuccess = function (event: any) {
      const db = event.target.result as IDBDatabase;
      const transaction = db.transaction(["paths"], "readwrite");
      const objectStore = transaction.objectStore("paths");
      const index = objectStore.index("path");

      const getRequest = index.get(currentPath);

      getRequest.onsuccess = function (event: any) {
        if (event.target.result) {
          console.log("Path already exists in Academy DB:", currentPath);
        } else {
          const addRequest = objectStore.add({ path: currentPath });

          addRequest.onsuccess = function () {
            console.log("Path has been added to Academy DB:", currentPath);
          };

          addRequest.onerror = function (event: any) {
            console.error("Error adding path:", event.target.errorCode);
          };
        }
      };

      getRequest.onerror = function (event: any) {
        console.error("Error checking path:", event.target.errorCode);
      };

      const getAllRequest = objectStore.getAll();

      getAllRequest.onsuccess = function (event: any) {
        // We no longer render checkmarks in the sidebar; this hook is kept
        // only for potential future tracking logic.
        const _paths = event.target.result as { path: string }[];
      };

      getAllRequest.onerror = function (event: any) {
        console.error("Error retrieving all paths:", event.target.errorCode);
      };
    };
  }, [currentPath]);

  return null;
};

export default IndexedDBComponent;


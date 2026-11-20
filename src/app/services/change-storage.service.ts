import { Injectable } from '@angular/core';
import { ChangeRequest } from '../models/change-request.model';

@Injectable({
  providedIn: 'root'
})
export class ChangeStorageService {

  private readonly databaseName = 'changeops';
  private readonly databaseVersion = 1;
  private readonly storeName = 'changes';

  private databasePromise?: Promise<IDBDatabase>;

  private openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(
        new Error('IndexedDB is not available in this browser.')
      );
    }

    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {

        const request = indexedDB.open(
          this.databaseName,
          this.databaseVersion
        );

        request.onupgradeneeded = () => {
          const database = request.result;

          if (!database.objectStoreNames.contains(this.storeName)) {
            const store = database.createObjectStore(
              this.storeName,
              { keyPath: 'id' }
            );

            store.createIndex('status', 'status');
            store.createIndex('createdAt', 'createdAt');
          }
        };

        request.onsuccess = () => {
          const database = request.result;

          database.onversionchange = () => {
            database.close();
            this.databasePromise = undefined;
          };

          resolve(database);
        };

        request.onerror = () => {
          this.databasePromise = undefined;
          reject(request.error);
        };

        request.onblocked = () => {
          this.databasePromise = undefined;
          reject(new Error('IndexedDB upgrade is blocked.'));
        };
      });
    }

    return this.databasePromise;
  }

  private async execute<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {

    const database = await this.openDatabase();

    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(
        this.storeName,
        mode
      );

      const store = transaction.objectStore(this.storeName);
      const request = operation(store);

      let result!: T;

      request.onsuccess = () => {
        result = request.result;
      };

      transaction.oncomplete = () => resolve(result);

      transaction.onerror = () => {
        reject(transaction.error ?? new Error('Database error'));
      };

      transaction.onabort = () => {
        reject(transaction.error ?? new Error('Transaction aborted'));
      };
    });
  }


  async updateAtomically(
    id: string,
    updater: (current: ChangeRequest) => ChangeRequest
  ): Promise<ChangeRequest> {
    const database = await this.openDatabase();

    return new Promise<ChangeRequest>((resolve, reject) => {
      const transaction = database.transaction(
        this.storeName,
        'readwrite'
      );

      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      let updated: ChangeRequest | undefined;
      let failure: Error | undefined;

      request.onsuccess = () => {
        try {
          const current = request.result as ChangeRequest | undefined;

          if (!current) {
            throw new Error('Change request not found.');
          }

          const next = updater(current);

          if (next.id !== id) {
            throw new Error('Cannot change request ID.');
          }

          store.put(next);
          updated = next;
        } catch (error) {
          failure = error instanceof Error
            ? error
            : new Error(String(error));

          transaction.abort();
        }
      };

      transaction.oncomplete = () => {
        if (updated) {
          resolve(updated);
        } else {
          reject(new Error('Update did not produce a result.'));
        }
      };

      transaction.onabort = () => {
        reject(
          failure ??
          transaction.error ??
          new Error('IndexedDB transaction aborted.')
        );
      };
    });
  }

  getAll(): Promise<ChangeRequest[]> {
    return this.execute(
      'readonly',
      store => store.getAll()
    );
  }

  getById(id: string): Promise<ChangeRequest | undefined> {
    return this.execute(
      'readonly',
      store => store.get(id)
    );
  }

  async save(change: ChangeRequest): Promise<void> {
    await this.execute(
      'readwrite',
      store => store.put(change)
    );
  }

  async delete(id: string): Promise<void> {
    await this.execute(
      'readwrite',
      store => store.delete(id)
    );
  }
}

//db.js

const DB_NAME = "GoogleAuthenticatorDB";
const DB_VERSION = 3;
const STORE_NAME = "accounts";

function openDatabase(){
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function (event){
            const db = event.target.result;
            if(db.objectStoreNames.contains(STORE_NAME)){
                db.deleteObjectStore(STORE_NAME);
            }
            db.createObjectStore(
                STORE_NAME,
                {
                    keyPath: "id"
                }
            );
            // if (!db.objectStoreNames.contains(STORE_NAME)){
            // }
        };

        request.onsuccess = function (){
            resolve(request.result);
        };

        request.onerror = function (){
            reject(request.error);
        };

    });
}

async function saveAccount(account){
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.put(account);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function getAccounts(){
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteAccount(accountId){
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.delete(accountId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function clearAccounts(){
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}


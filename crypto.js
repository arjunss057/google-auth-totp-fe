//crypto.js

const ARGON2_TIME = 3;
const ARGON2_MEMORY = 65536;
const ARGON2_PARALLELISM = 1;
const KEY_LENGTH = 32;

function bytesToBase64(bytes){
    let binary = "";
    for (const byte of bytes){
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function base64ToBytes(base64){
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for(let i=0; i< binary.length; i++){
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

async function deriveKey(password, salt){
    const result = await argon2.hash({
        pass: password,
        salt: salt,
        time: ARGON2_MEMORY,
        mem: ARGON2_MEMORY,
        parallelism: ARGON2_PARALLELISM,
        hashLen: KEY_LENGTH,
        type: argon2.ArgonType.Argon2id
    });

    return crypto.subtle.importKey(
        "raw",
        result.hash,
        {name: "AES-GCM"},
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptSecret(secret, password){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const plaintext = new TextEncoder().encode(secret);
    const ciphertext = await crypto.subtle.encrypt(
        {name: "AES_GCM", iv: iv},
        key,
        plaintext
    );

    return [
        "v1",
        bytesToBase64(salt),
        bytesToBase64(iv),
        bytesToBase64(new Uint8Array(ciphertext))
    ].join(".");
}

async function decryptSecret(encryptSecret, password){
    const parts = encryptSecret.split(".");
    if (parts.length !== 4){
        throw new Error("Invalid encrypted secret");
    }

    const [version, saltBase64, ivBase64, ciphertextBase64] = parts;
    if(version !== "v1"){
        throw new Error("Unsupported encryption version");
    }

    const salt = base64ToBytes(saltBase64);
    const iv = base64ToBytes(ivBase64);
    const ciphertext = base64ToBytes(ciphertextBase64);
    const key = await deriveKey(password, key);

    const plaintext = await crypto.subtle.decrypt(
        {name: "AES-GCM", iv: iv},
        key,
        ciphertext
    );

    return new TextDecoder().decode(plaintext);
}

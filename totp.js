function base32ToBytes(base32) {

    const alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    const cleaned =
        base32
            .toUpperCase()
            .replace(/[\s-]/g, "")
            .replace(/=+$/, "");

    let bits = "";

    for (const char of cleaned) {

        const value =
            alphabet.indexOf(char);

        if (value === -1) {
            throw new Error(
                "Invalid Base32 secret"
            );
        }

        bits += value
            .toString(2)
            .padStart(5, "0");
    }

    const bytes = [];

    for (
        let i = 0;
        i + 8 <= bits.length;
        i += 8
    ) {

        bytes.push(
            parseInt(
                bits.substring(i, i + 8),
                2
            )
        );
    }

    return new Uint8Array(bytes);
}


async function generateTOTP(
    secret,
    timestamp = Date.now()
) {

    const secretBytes =
        base32ToBytes(secret);


    /*
     * TOTP uses:
     *
     * counter = floor(time / 30)
     */

    const counter =
        Math.floor(
            timestamp / 1000 / 30
        );


    /*
     * Convert counter to
     * 8-byte big-endian integer.
     */

    const counterBytes =
        new ArrayBuffer(8);

    const counterView =
        new DataView(counterBytes);

    const high =
        Math.floor(
            counter / 0x100000000
        );

    const low =
        counter % 0x100000000;

    counterView.setUint32(
        0,
        high
    );

    counterView.setUint32(
        4,
        low
    );


    /*
     * HMAC-SHA1
     */

    const key =
        await crypto.subtle.importKey(
            "raw",

            secretBytes,

            {
                name: "HMAC",
                hash: "SHA-1"
            },

            false,

            ["sign"]
        );


    const hash =
        new Uint8Array(
            await crypto.subtle.sign(
                "HMAC",
                key,
                counterBytes
            )
        );


    /*
     * Dynamic truncation
     */

    const offset =
        hash[hash.length - 1] & 0x0f;


    const binaryCode =
        (
            ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff)
        ) >>> 0;


    const code =
        binaryCode % 1000000;


    return code
        .toString()
        .padStart(6, "0");
}


function getTOTPRemainingSeconds(
    timestamp = Date.now()
) {

    return 30 -
        (
            Math.floor(
                timestamp / 1000
            ) % 30
        );
}

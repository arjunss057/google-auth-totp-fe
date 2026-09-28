//app.js

API_URL = "http://localhost:8000";

let googleAccessToken = localStorage.getItem("google_access_token");
let googlePassword = null;

let qrScanner = null;

async function api(endpoint, options = {}){
    const headers = options.headers || {};
    if(options.body && typeof options.body !== "String"){
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
    }

    if (googleAccessToken){
        headers["Authorization"] = `Bearer ${googleAccessToken}`;
    }

    const response = await fetch(API_URL + endpoint, {...options, headers});
    let data = null;
    try{
        data = await response.json();
    }
    catch {
        data = null;
    }

    if (!response.ok){
        throw new Error(data?.detail || "Request failed");
    }

    return data;
}

async function register(){
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    try{
        const data = await api(
            endpoint = "/register",
            options = {
                method: "POST",
                body: {
                    username: username,
                    password: password
                }
            }
        );

        setAuthMessage(`Account created. User ID: ${data.user_id}`);
    } catch(error){
        setAuthMessage(error.message);
    }
}

async function login(){
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    try{
        const data = await api(
            endpoint = "/login",
            options = {
                method: "POST",
                body: {
                    username: username,
                    password: password
                }
            }
        );
        googleAccessToken = data.access_token;
        localStorage.setItem("google_access_token", googleAccessToken);
        googlePassword = password;
        await showAuthenticator();
    } catch(error) {
        setAuthMessage(error.message);
    }
}

async function showAuthenticator(){
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("authenticatorSection").classList.remove("hidden");

    const user = await api(endpoint = "/me");
    document.getElementById("loggedInUser").textContent = `Logged in as ${user.username}`;
    await loadAccounts();
}

async function loadAccounts(){
    const accounts = await api(endpoint = "/authenticator/accounts");
    const container = document.getElementById("accountsContainer");
    container.innerHTML = "";
    if (accounts.length === 0){
        container.innerHTML  = "<p>No accounts yet.</p>";
        return ;
    }

    for (const account of accounts){
        const element = document.createElement("div");
        element.className = "account";
        element.innerHTML = `
            <strong>
                ${escapeHtml(
                    account.service_name
                )}
            </strong>

            <div class="account-name">
                ${escapeHtml(
                    account.account_name
                )}
            </div>

            <div
                id="code-${account.id}"
                class="totp-code"
            >
                ------
            </div>

            <div
                id="timer-${account.id}"
                class="timer"
            >
                Loading...
            </div>

            <button
                class="danger"
                onclick="deleteAuthenticatorAccount(
                    ${account.id}
                )"
            >
                Delete
            </button>
        `;

        container.appendChild(element);
        generateCode(account);
    }
}

async function generateCode(account){
    try{
        if (!googlePassword){
            throw new Error("Google password is not available");
        }
        // const secret = await decryptSecret(account.service_secret, googlePassword);
        const secret = account.service_secret;
        console.log(secret);
        updateCode(account.id, secret);
    } catch(error){
        console.error("TOTP error: ", error);
        document.getElementById(`code-${account.id}`).textContent = "ERROR";
    }
}

function updateCode(accountId, secret){
    async function update(){
        try{
            // const code = otplib.authenticator.generate(secret);
            const code = await generateTOTP(secret);
            // const remaining = 30 - (Math.floor(Date.now()/1000) % 30);
            const remaining = getTOTPRemainingSeconds();
            const codeElement = document.getElementById(`code-${accountId}`);
            const timerElement = document.getElementById(`timer-${accountId}`);
            if (codeElement){
                codeElement.textContent = code;
            }
            if (timerElement) {
                timerElement.textContent = `${remaining}s`
            }
        } catch(error){
            console.error("TOTP generation error: ", error);
            const codeElement = document.getElementById(`code-${accountId}`);
            if (codeElement){
                codeElement.textContent = "ERROR";
            }
        }
    }
    update();
    setInterval(update, 1000);
}

async function startQrScanner(){
    console.log("QR scanner button clicked");
    const scannerElement = document.getElementById("qrScanner");
    scannerElement.classList.remove("hidden");
    document.getElementById("stopScannerButton").classList.remove("hidden");
    qrScanner = new Html5Qrcode("qrScanner");
    try{
        await qrScanner.start(
            {facingMode: "environment"},
            {
                fps: 10,
                qrbox: {
                    width: 250,
                    height: 250
                }
            },

            async (decodedText) => {
                console.log("QR detected: ", decodedText);
                await handleOtpAuthUri(decodedText);
                await stopQrScanner();
            },
            (errorMessage) => {}
        );
    } catch(error){
        console.error("Unable to start QR scanner: ", error);
        setAccountMessage(`Unavle to access camera: ${error.message}`);
        await stopQrScanner();
    }
}

async function stopQrScanner(){
    if(qrScanner){
        try{
            await qrScanner.stop();
            qrScanner.clear();
        } catch(error){
            console.error("Error stopping QR scanner: ", error);
        }
        qrScanner = null;
    }

    document.getElementById("qrScanner").classList.add("hidden");
    document.getElementById("stopScannerButton").classList.add("hidden");

}

async function handleOtpAuthUri(uri){
    try{
        const parsed = parseOtpAuthUri(uri);
        if(!parsed){
            throw new Error("Invalid TOTP QR Code");
        }
        console.log("Parse TOTP: ", parsed);
        document.getElementById("serviceName").value = parsed.issuer;
        document.getElementById("accountName").value = parsed.account;
        document.getElementById("serviceSecret").value = parsed.secret;

        setAccountMessage("QR scanned successfully. Review the details and add the account. ");
    } catch(error){
        console.log("QR parsing error: ", error);
        setAccountMessage(error.message);
    }
}

function parseOtpAuthUri(uri){
    if(!uri.startsWith("otpauth://")){
        throw new Error("This QR code is not a TOTP enrollment QR code");
    }
    const url = new URL(uri);
    if(url.protocol !== "otpauth:"){
        throw new Error("Invalid otpauth URI");
    }
    const secret = url.searchParams.get("secret");
    if(!secret){
        throw new Error("QR code does not contain a secret");
    }
    const label = decodeURIComponent(url.pathname.substring(1));
    let issuer = url.searchParams.get("issuer");
    let account = label;
    if(label.includes(":")){
        const parts = label.split(":");
        issuer = issuer || parts.shift();
        account = parts.join(":");
    }
    if(!issuer){
        issuer = "Unknown"
    }

    return {
        issuer,
        account,
        secret,
        algorithm: url.searchParams.get("algorithm") || "SHA1",
        digits: Number(url.searchParams.get("digits") || 6),
        period: Number(url.searchParams.get("period") || 30)
    };
}

async function addAccount(){
    const serviceName = document.getElementById("serviceName").value.trim();
    const accountName = document.getElementById("accountName").value.trim();
    const serviceSecret = document.getElementById("serviceSecret").value.trim();

    if(!serviceName || !accountName || !serviceSecret){
        console.log("inside if");
        setAccountMessage("All fields are required");
        return;
    }

    try{
        if (!googlePassword){
            throw new Error("Please login again");
        }
        // const encryptedSecret = await encryptSecret(serviceSecret, googlePassword);
        const encryptedSecret = serviceSecret;
        const account = await api(
            endpoint = "/authenticator/accounts",
            options = {
                method: "POST",
                body: {
                    service_name: serviceName,
                    account_name: accountName,
                    service_secret: serviceSecret
                }
            }
        );

        await saveAccount({
            id: account.id,
            service_name: account.service_name,
            account_name: account.account_name,
            service_secret: encryptedSecret
        })

        setAccountMessage("Account Added");

        document.getElementById("serviceName").value = "";
        document.getElementById("accountName").value = "";
        document.getElementById("serviceSecret").value = "";

        await loadAccounts();
    } catch(error){
        setAccountMessage(error.message);
    }
}

async function deleteAuthenticatorAccount(accountId){
    try {
        await api(
            endpoint = `/authenticator/accounts/${accountId}`,
            options = {
                method: "DELETE"
            }
        );
        await deleteAccount(accountId);
        await loadAccounts();
    } catch(error){
        alert(error.message);
    }
}

async function changePassword(){
    const oldPassword = document.getElementById("oldPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    if(!oldPassword || !newPassword){
        setPasswordMessage("Both passwords are required");
        return;
    }

    try{
        const accounts = await api(
            endpoint = "/authenticator/accounts"
        );
        const reencryptedAccounts = [];
        for (const account of accounts){
            // const secret = await decryptSecret(account.service_secret, oldPassword);
            const secret = account.service_secret;
            // const encryptedSecret = await encryptSecret(secret, newPassword);
            const encryptedSecret = secret;
            reencryptedAccounts.push({
                account_id: account.id,
                service_secret: encryptedSecret
            });
        }
        await api(
            endpoint = "/change-password",
            options = {
                method: "POST",
                body: {
                    old_password: oldPassword,
                    new_password: newPassword,
                    accounts: reencryptedAccounts
                }
            }
        );

        googlePassword = newPassword;

        document.getElementById("oldPassword").value = "";
        document.getElementById("newPassword").value = "";
        setPasswordMessage("Password changed successfully");
    } catch(error){
        setPasswordMessage(error.message || "Password change failed");
    }
}

function logout(){
    googleAccessToken = null;
    googlePassword = null;
    localStorage.removeItem("google_access_token");
    document.getElementById("authSection").classList.remove("hidden");
    document.getElementById("authenticatorSection").classList.add("hidden");
}

function setAuthMessage(message){
    document.getElementById("authMessage").textContent = message;
}

function setAccountMessage(message){
    document.getElementById("accountMessage").textContent = message;
}

function setPasswordMessage(message){
    document.getElementById("passwordMessage").textContent = message;
}

function escapeHtml(value){
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}

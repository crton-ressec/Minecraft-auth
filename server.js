const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3030;

const DEVICE_CODE_URL = "https://login.live.com/oauth20_connect.srf";
const TOKEN_URL = "https://login.live.com/oauth20_token.srf";
const XBL_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const RELYING_PARTY = "https://multiplayer.minecraft.net/";

const CLIENT_ID = "000000004c12ae29";
const SCOPE = "service::user.auth.xboxlive.com::MBI_SSL";

app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    try {
        // TYPO FIX 1: Changed URLSearcParams to URLSearchParams
        const deviceCodeRes = await axios.post(DEVICE_CODE_URL, new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const data = deviceCodeRes.data;
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bedrock File Builder</title>
                <style>
                    body { font-family: -apple-system, sans-serif; text-align: center; padding: 30px 15px; background: #111; color: #fff; }
                    .code-box { font-size: 32px; font-weight: bold; color: #107c10; background: #222; padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 300px; letter-spacing: 2px; }
                    .btn { display: inline-block; padding: 15px 30px; background: #007aff; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px; }
                </style>
            </head>
            <body>
                <h2>Minecraft Account Pairing Engine</h2>
                <p>1. Copy this official authentication code:</p>
                <div class="code-box">${data.user_code}</div>
                
                <p>2. Tap the button below to link it on Microsoft's verification portal:</p>
                <a class="btn" href="${data.verification_uri}" target="_blank">Authorize via Microsoft</a>
                
                <p>3. Once you accept the prompt in Safari clicking generate:</p>
                <form action="/verify" method="POST">
                    <input type="hidden" name="device_code" value="${data.device_code}">
                    <button type="submit" class="btn" style="background:#107c10;">Generate XBLStoage.json</button>
                </form>
            </body>
            </html>`);
    } catch (err) {
        res.status(500).send("Initialization Error: Unable to fetch connection parameters from Microsoft.");
    }
});

// TYPO FIX 2: Changed app.POST to app.post (Express routing methods must be lowercase)
app.post('/verify', async (req, res) => {
    const deviceCode = req.body.device_code;
    try {
        // TYPO FIX 3: Changed TRLSearchParams to URLSearchParams
        const msTokenRes = await axios.post(TOKEN_URL, new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: deviceCode
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const msAccessToken = msTokenRes.data.access_token;

        const xblRes = await axios.post(XBL_AUTH_URL, {
            Properties: {
                AuthMethod: "RPS",
                SiteName: "user.auth.xboxlive.com",
                RpsTicket: `d=${msAccessToken}`
            },
            RelyingParty: "http://auth.xboxlive.com",
            TokenType: "JWT"
        });

        const userToken = xblRes.data.Token;

        const xstsRes = await axios.post(XSTS_AUTH_URL, {
            Properties: {
                SandboxId: "RETAIL",
                UserTokens: [userToken]
            },
            RelyingParty: RELYING_PARTY,
            TokenType: "JWT"
        });

        const finalToken = xstsRes.data.Token;
        const xuid = xstsRes.data.DisplayClaims.xui.xid;
        const gamertag = xstsRes.data.DisplayClaims.xui.gtg;

        const fileContent = {
            "com.mojang.minecraftpe": {
                "UserToken": finalToken,
                "Gamertag": gamertag,
                "Xuid": xuid,
                "IsSignedIn": true
            }
        };

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Download Ready</title>
                <style>
                    body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #111; color: #fff; }
                    .btn { display: inline-block; padding: 15px 30px; background: #107c10; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; cursor: pointer; }
                </style>
            </head>
            <body>
                <h2>Profile Authentication Successful!</h2>
                <!-- TYPO FIX 4: Changed 3cstrong> to <strong> -->
                <p>Linked Username: <strong>${gamertag}</strong></p>
                <a class="btn" id="dlJson">Download XBLStoage.json</a>
                <script>
                    // Pass the backend data safely to the frontend script template
                    const fileData = ${JSON.stringify(fileContent)};
                    document.getElementById('dlJson').addEventListener('click', () => {
                        // TYPO FIX 5: Changed JSON.stringifu to JSON.stringify
                        const blob = new Blob([JSON.stringify(fileData, null, 2)], {type: "application/json"});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = "XBLStoage.json";
                        a.click();
                    });
                </script>
            </body>
            </html>`);

    } catch (err) {
        res.status(400).send("Handshake Pending: You must finish entering the code in Safari before clicking the generate button.");
    }
});

app.listen(PORT, () => console.log(`Active server operating on port ${PORT}`));

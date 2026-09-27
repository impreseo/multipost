# WELZ Publisher — Official API Connection & OAuth Setup Guide

This guide provides step-by-step instructions for configuring official developer applications and OAuth credentials for LinkedIn, Meta / Instagram Professional, and WhatsApp Business Cloud API in WELZ Publisher.

---

## 1. Overview of the Connection Architecture

WELZ Publisher uses the **Official OAuth 2.0 Authorization Code flow with loopback redirect URI** (compliant with [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)).

```
┌─────────────────┐       1. Click Connect       ┌─────────────────────┐
│  WELZ Publisher │ ───────────────────────────> │  OAuth Manager      │
│  (Desktop App)  │                              │  (Electron Main)    │
└─────────────────┘                              └──────────┬──────────┘
         ▲                                                  │ 2. Start loopback server
         │                                                  │    & launch browser
         │ 6. Token encrypted in safeStorage                ▼
         │    & account metadata stored          ┌─────────────────────┐
         │                                       │   Official Provider │
         └────────────────────────────────────── │   Login & Consent   │
              5. Callback with auth code         └─────────────────────┘
                 to http://127.0.0.1:54321/callback
```

### Key Security Principles:
- **Zero Plaintext Tokens**: Tokens and client secrets are encrypted at rest using Electron's native `safeStorage` (Windows DPAPI / macOS Keychain / Linux Secret Service).
- **Secure Boundary**: Secrets and access tokens **never** cross into the renderer process or SQLite database.
- **CSRF & PKCE Protected**: Authorization requests use cryptographically random state verification and PKCE where supported.

---

## 2. Standard Redirect URI

For all providers below, register this exact Redirect URI:

```
http://127.0.0.1:54321/callback
```

*(Note: Both LinkedIn and Meta allow `http://127.0.0.1` and `http://localhost` for native application development and authorized redirect URLs).*

---

## 3. LinkedIn (Personal Profile & Organization Pages)

### Step 1: Create a LinkedIn Developer Application
1. Go to the [LinkedIn Developer Portal](https://www.linkedin.com/developers/).
2. Log in with your LinkedIn account and click **Create App**.
3. Fill in:
   - **App name**: `WELZ Publisher` (or your company name).
   - **LinkedIn Page**: Associate your LinkedIn Company / Organization Page.
   - **Privacy policy URL**: Provide a valid URL.
   - **App logo**: Upload your logo.
4. Agree to the legal terms and click **Create app**.

### Step 2: Request Required Products & Permissions
Under the **Products** tab of your app:
- Select **Share on LinkedIn** and click **Request access** (grants `w_member_social`).
- Select **Sign In with LinkedIn using OpenID Connect** and click **Request access** (grants `openid`, `profile`, `email`).
- For Organization Publishing: Select **Community Management API** or **Advertising API** / organization permissions (grants `w_organization_social`).

Required Scopes:
- `w_member_social`: Publishing to personal member profiles.
- `w_organization_social`: Publishing to LinkedIn Organization Pages.
- `openid`, `profile`, `email`: Identity discovery and member verification.

### Step 3: Configure Redirect URI & Retrieve Credentials
1. Go to the **Auth** tab.
2. In the **OAuth 2.0 settings** section, under **Authorized redirect URLs for your app**, click the edit icon and add:
   ```
   http://127.0.0.1:54321/callback
   ```
3. Copy the **Client ID** and **Client Secret**.

### Step 4: Configure WELZ Publisher
1. Open WELZ Publisher → Click **Settings** (gear icon) in the bottom-right.
2. Under **API Connections & OAuth Setup** → **LinkedIn Developer App**:
   - Paste your **Client ID**.
   - Paste your **Client Secret**.
   - Click **Save LinkedIn Credentials**.
3. Now open **Connections** (plug icon) → Click **Connect LinkedIn**.
4. Your default browser opens the official LinkedIn permission consent dialog. Click **Allow**.
5. The browser displays "✓ Authorization Successful". Return to WELZ Publisher — your LinkedIn personal and page destinations appear connected!

---

## 4. Instagram Professional Account (Meta Graph API)

### Prerequisites:
- A Facebook Page linked to your Instagram Professional (Business or Creator) account.
- If you have a Personal Instagram account, convert it to a Creator or Business account in the Instagram Mobile App under `Settings > Account > Switch to professional account`.

### Step 1: Create a Meta Developer App
1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** → **Create App**.
3. Choose use case: **Other** → Click **Next**.
4. Select App Type: **Business** → Click **Next**.
5. Enter **App Name** (e.g. `WELZ Publisher`) and contact email → Click **Create app**.

### Step 2: Add Instagram Graph API & Facebook Login
1. On the App Dashboard, find **Instagram** and click **Set Up**.
2. Find **Facebook Login for Business** and click **Set Up**.
3. Go to **Facebook Login for Business** → **Settings**:
   - Under **Valid OAuth Redirect URIs**, enter:
     ```
     http://127.0.0.1:54321/callback
     ```
   - Save changes.

### Step 3: Required Permissions
For publishing content via the Instagram Graph API, the following permissions are requested during OAuth:
- `instagram_basic`: Basic profile reading and Instagram Account ID lookup.
- `instagram_content_publish`: Publishing photo, video, carousel, and Reel posts to your Instagram Professional Account.
- `pages_show_list`: Discovering Facebook Pages managed by the user.
- `pages_read_engagement`: Finding the connected Instagram Business account attached to each page.
- `business_management`: Discovering associated Meta Business Assets.

*(Note: During development, you can test with Administrator, Developer, or Tester roles added under **App Roles > Roles** without Meta App Review).*

### Step 4: Retrieve App Credentials
1. Go to **App Settings** → **Basic**.
2. Copy the **App ID**.
3. Under **App Secret**, click **Show** and copy your secret.

### Step 5: Configure WELZ Publisher
1. Open WELZ Publisher → Click **Settings** → **Meta / Instagram App**.
2. Paste your **Meta App ID** and **Meta App Secret**.
3. Click **Save Meta Credentials**.
4. Go to **Connections** → Click **Connect Instagram**.
5. Approve permissions in your browser. WELZ will automatically discover your `@username` and link the Professional destination.

### Media Requirement Note for Instagram:
Meta's Instagram Content Publishing API requires media files to be publicly accessible via HTTPS URLs for Meta servers to download and process containers. For local files, ensure your media asset is uploaded to a remote CDN/bucket or public endpoint when publishing live to Instagram.

---

## 5. WhatsApp Business Cloud API

### Step 1: Set Up Meta WhatsApp Cloud API
1. In [Meta for Developers](https://developers.facebook.com/), open your Business App.
2. Under **Add products to your app**, select **WhatsApp** and click **Set up**.
3. Meta will generate a **WhatsApp Business Account (WABA)** and provide a sandbox test phone number.

### Step 2: Retrieve Cloud API Credentials
1. Go to **WhatsApp** → **API Setup** in your Meta App Dashboard.
2. Note your **Phone number ID** (e.g. `109876543210987`).
3. Note your **WhatsApp Business Account ID** (WABA ID).
4. For production, generate a **System User Permanent Access Token** in [Meta Business Suite](https://business.facebook.com/) under `Settings > Users > System Users` with `whatsapp_business_messaging` and `whatsapp_business_management` permissions.

### Step 3: Configure WELZ Publisher
1. In WELZ Publisher → **Settings** → **WhatsApp Cloud API**:
   - Enter your **Phone Number ID**.
   - Enter your **WhatsApp Business Account ID**.
   - Enter your **System User Access Token**.
   - Click **Save WhatsApp Credentials**.
2. In **Connections**, click **Connect WhatsApp**.
3. WELZ verifies the credentials against the WhatsApp Cloud API and discovers your registered business name and phone number.

---

## 6. Testing & Verifying Connections

1. **Test Connection Button**:
   - In **Connections**, click **Test Connection** next to any connected platform.
   - WELZ performs a live ping to the platform's profile endpoint (`/v2/userinfo` for LinkedIn, `/me/accounts` for Instagram, `/v21.0/{phone_number_id}` for WhatsApp).
   - If the token is valid, you will see a green confirmation toast and updated timestamp.

2. **Publish Test Post**:
   - In the composer workstation, write a short test message (e.g., `Testing publishing pipeline via WELZ Publisher.`).
   - Select the target destination from the top bar.
   - Click **Publish now**.
   - WELZ displays the pre-dispatch confirmation modal.
   - Upon confirming, WELZ dispatches through the official API and records the remote external post ID.

---

## 7. Troubleshooting & Common Errors

| Error | Cause | Resolution |
| :--- | :--- | :--- |
| `redirect_uri_mismatch` | Registered redirect URI does not match | Ensure `http://127.0.0.1:54321/callback` is added under Authorized Redirect URLs in Developer Portal. |
| `Scope not approved` | The Developer App hasn't requested the required permission | Request the specific product (e.g., "Share on LinkedIn") in the developer portal. |
| `401 Unauthorized` | Access token expired or invalid | Click **Disconnect** then **Connect** to re-authorize. |
| `403 Forbidden (w_organization_social)` | User is not an Administrator of the LinkedIn Page | Ensure your LinkedIn profile has the Administrator role on the target Organization Page. |
| `Media requires public HTTPS URL` | Instagram requires remote URL | Upload media asset to an HTTPS host before Instagram container creation. |
| `OS encryption unavailable` | System keychain not available | Run on a supported desktop platform with OS credential storage enabled. |

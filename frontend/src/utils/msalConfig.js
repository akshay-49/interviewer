import { PublicClientApplication } from "@azure/msal-browser";

// Get from your Azure AD app registration (via environment variables)
const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || "YOUR_CLIENT_ID";
const AZURE_AUTHORITY = import.meta.env.VITE_AZURE_AUTHORITY || "https://login.microsoftonline.com/common";
const AZURE_REDIRECT_URI = import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin;

console.log('MSAL Config:', {
    clientId: AZURE_CLIENT_ID,
    authority: AZURE_AUTHORITY,
    redirectUri: AZURE_REDIRECT_URI
});

const msalConfig = {
    auth: {
        clientId: AZURE_CLIENT_ID,
        authority: AZURE_AUTHORITY,
        redirectUri: AZURE_REDIRECT_URI,
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (!containsPii) {
                    console.log(`[MSAL] ${level}: ${message}`);
                }
            },
            level: 2,
            piiLoggingEnabled: false,
        },
    },
};

// Create and initialize MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize immediately
msalInstance.initialize().catch(err => {
    console.error('MSAL initialization error:', err);
});

export const getMsalInstance = () => msalInstance;

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
console.log('VITE_AZURE_CLIENT_ID:', clientId);

// Use client ID as the scopes to get token with correct audience
export const loginRequest = {
    scopes: [`${clientId}/.default`, "openid", "profile", "email"],
};

export const tokenRequest = {
    scopes: [`${clientId}/.default`],
};

console.log('Login request scopes:', loginRequest.scopes);
console.log('Token request scopes:', tokenRequest.scopes);

export { msalInstance };

import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

const Auth0ProviderComponent = ({ children }) => {
    const domain = import.meta.env.VITE_AUTH0_DOMAIN;
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
    const redirectUri = `${window.location.origin}/callback`;

    if (!domain || !clientId) {
        console.error('Auth0 environment variables not configured');
        throw new Error('Auth0 environment variables not configured');
    }

    return (
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            authorizationParams={{
                redirect_uri: redirectUri,
                audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                scope: 'openid profile email',
                screen_hint: 'login',
                prompt: 'login',
            }}
            cacheLocation="memory"
            useRefreshTokens={false}
            skipRedirectCallback={false}
        >
            {children}
        </Auth0Provider>
    );
};

export default Auth0ProviderComponent;

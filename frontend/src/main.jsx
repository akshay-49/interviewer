import React from 'react'
import ReactDOM from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import App from './App'
import './index.css'

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN || 'your-tenant.auth0.com';
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID || 'your-client-id';
const redirectUri = window.location.origin;

console.log('Auth0 Configuration:', {
  domain: auth0Domain,
  clientId: auth0ClientId,
  redirectUri: redirectUri
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        scope: "openid profile email"
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>,
)

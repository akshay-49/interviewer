import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Auth0ProviderComponent from './utils/auth0Config.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0ProviderComponent>
      <App />
    </Auth0ProviderComponent>
  </React.StrictMode>
)

import React from 'react';

// ProtectedRoute is no longer needed with invite-only architecture
// Everyone accessing the app is authenticated via invite code
const ProtectedRoute = ({ children }) => {
    return children;
};

export default ProtectedRoute;

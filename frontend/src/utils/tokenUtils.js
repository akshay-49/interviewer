/**
 * Utility functions for JWT token handling
 */

/**
 * Generate a dummy JWT token for testing
 * Format: base64(header).base64(payload).base64(signature)
 * @returns {string} A valid JWT-formatted token
 */
export function generateDummyJWT() {
    // Header: {alg: "HS256", typ: "JWT"}
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    
    // Payload with standard claims
    const payload = btoa(JSON.stringify({
        sub: 'test_user',
        email: 'admin@test.com',
        name: 'Test Admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    }));
    
    // Signature (dummy - just for format, not cryptographically valid)
    const signature = btoa('dummy_signature_for_testing');
    
    return `${header}.${payload}.${signature}`;
}

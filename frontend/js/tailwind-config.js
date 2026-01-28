// Tailwind CSS Configuration
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                colors: {
                    "primary": "#365c63",
                    "primary-dark": "#2a484e",
                    "accent": "#5F9479",
                    "background-light": "#f9fafa",
                    "background-dark": "#22252a",
                    "surface-light": "#ffffff",
                    "surface-dark": "#2d3138",
                    "text-main": "#121617",
                    "text-muted": "#657c81",
                },
                fontFamily: {
                    "display": ["Manrope", "sans-serif"]
                },
                borderRadius: {
                    "DEFAULT": "0.5rem",
                    "lg": "0.75rem",
                    "xl": "1rem",
                    "2xl": "1.5rem",
                    "full": "9999px"
                },
                boxShadow: {
                    'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                    'glow': '0 0 15px rgba(54, 92, 99, 0.2)',
                }
            },
        },
    }
}

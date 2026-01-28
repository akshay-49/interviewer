# AI Interview Coach - Frontend

A modern, voice-based interview preparation application built with vanilla JavaScript and Tailwind CSS.

## Project Structure

```
frontend/
├── index.html              # Main entry point
├── package.json           # Dependencies and scripts
├── css/
│   └── main.css          # Global styles and animations
├── js/
│   ├── app.js            # Main application logic
│   ├── router.js         # Routing configuration
│   ├── tailwind-config.js # Tailwind configuration
│   └── screens/          # Screen components
│       ├── welcome.js    # Welcome screen
│       ├── setup.js      # Setup/configuration screen
│       ├── interview.js  # Interview in-progress screen
│       └── results.js    # Results summary screen
└── README.md             # This file
```

## Features

- **Welcome Screen**: Engaging introduction and entry point
- **Setup Screen**: Configure interview type, duration, and difficulty
- **Interview Screen**: Voice-based interview with real-time feedback
- **Results Screen**: Performance summary with detailed feedback
- **Dark Mode**: Built-in light/dark theme support
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern UI**: Clean design using Tailwind CSS and Material Design icons

## Color Palette

- **Primary**: #365c63 (Dark Teal)
- **Primary Dark**: #2a484e (Darker Teal)
- **Accent**: #5F9479 (Sage Green)
- **Background Light**: #f9fafa (Off White)
- **Background Dark**: #22252a (Charcoal)

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Usage

1. Open `index.html` in your browser or run with a dev server
2. Click "Start Interview Session" on the welcome screen
3. Configure your interview preferences
4. Answer interview questions using your microphone
5. Review your performance summary

## Browser Support

- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Keyboard Shortcuts

- `Esc` - Go back (on most screens)
- `Enter` - Confirm action (on buttons)

## Future Enhancements

- [ ] Backend integration for AI-powered feedback
- [ ] Speech recognition and analysis
- [ ] User authentication
- [ ] Interview history and progress tracking
- [ ] Custom question sets
- [ ] Performance analytics dashboard
- [ ] Export results as PDF
- [ ] Mobile app version

## Technical Stack

- **HTML5** - Markup
- **Tailwind CSS** - Styling
- **Vanilla JavaScript (ES6+)** - Logic
- **Material Design Icons** - Icons
- **Google Fonts (Manrope)** - Typography

## Notes

Currently, this is a standalone frontend without backend integration. To connect with the AI backend:

1. Add API endpoints to communicate with `backend/main.py`
2. Implement speech-to-text conversion
3. Add WebSocket support for real-time communication
4. Implement user authentication

## License

MIT License - See LICENSE file for details

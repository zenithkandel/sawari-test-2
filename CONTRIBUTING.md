# Contributing to Sawari

Thank you for your interest in contributing to Sawari! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment (XAMPP with PHP 8+)
4. Copy `.env.example` to `.env` and configure your API keys
5. Import the transit data into the `data/` directory

## Development Setup

```bash
# Clone the repo into your XAMPP htdocs
cd /path/to/xampp/htdocs
git clone https://github.com/your-username/sawari.git

# Copy environment config
cp .env.example .env
# Edit .env with your GROQ_API_KEY and ADMIN_PASSWORD
```

## Project Structure

```
sawari/
  index.php          # Public transit navigator
  landing.php        # Project landing page
  app.js             # Main application logic
  routing.js         # OSRM routing utilities
  style.css          # Public styles
  admin/             # Admin dashboard (password-protected)
  backend/           # PHP API handlers, validators, data store
  data/              # JSON flat-file data storage
  docs/              # Project documentation
```

## How to Contribute

### Reporting Bugs

- Check existing issues first to avoid duplicates
- Include steps to reproduce, expected behavior, and actual behavior
- Include browser and OS information

### Submitting Changes

1. Create a feature branch from `master`
2. Make your changes following the existing code style
3. Test your changes thoroughly
4. Submit a pull request with a clear description

### Code Style

- Vanilla JavaScript (no frameworks, no build tools)
- IIFE module pattern for admin modules
- PHP 8+ for backend
- CSS custom properties for theming
- Keep it simple, avoid over-engineering

### Areas for Contribution

- Adding new transit routes and stops data for Kathmandu
- Improving fare calculation accuracy
- Better mobile responsiveness
- Accessibility improvements
- Performance optimizations
- Documentation and translations

## Code of Conduct

Be respectful and constructive. This is an open-source project built to improve public transit navigation in Kathmandu.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Built by [Zenith Kandel](https://zenithkandel.com.np)

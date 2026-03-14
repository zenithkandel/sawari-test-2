# Sawari - What Is It?

**Sawari** (meaning "ride" in Nepali) is a public transit navigation app for Kathmandu Valley. Think of it like Google Maps, but specifically built for Nepal's bus and microbus network.

## The Problem It Solves

Getting around Kathmandu by bus is confusing. There are dozens of routes, no official app, and unless you already know which bus to take, you're stuck asking strangers or taking a taxi. Sawari fixes that.

## How It Works

1. **Open the app** in your browser — no download needed
2. **Tell it where you want to go** — type a place name, tap the map, or just say it in plain language like "take me from Ratnapark to Lagankhel"
3. **Get your route** — Sawari shows you which bus to catch, where to board, where to get off, and even where to transfer if needed
4. **See the fare** — know exactly how much you'll pay before you board (regular and student/elderly discounts)
5. **Track buses live** — see where your bus is right now on the map

## Key Features Worth Knowing

### Smart Navigation

You don't need to know stop names. Just type something like "Bagbazar to Basundhara" and the AI figures out what you mean. It finds the best bus route, including transfers if a direct route doesn't exist. Walking directions are shown for the first and last mile.

### Fare Calculator

Every route shows the estimated fare based on Nepal's official DoTM tariff rates. Prices are shown in ranges (bus vs microbus) and always in realistic Rs 5 increments — no made-up numbers. Student and elderly discounts are shown too.

### Live Vehicle Tracking

Buses and microbuses show up on the map in real time. When you navigate a route, Sawari assigns the nearest available vehicle to each leg of your journey and estimates when it'll arrive.

### Carbon Savings

Every trip shows how much CO2 you're saving by taking the bus instead of a car. A small nudge toward greener commuting.

### Works on Any Device

It's a web app — works on phones, tablets, and computers. Dark and light themes are available, and the interface adapts to your screen size.

### GPS Integration

Turn on GPS and Sawari shows your location on the map, finds nearby stops, and lets you set your current position as the starting point with one tap.

### Obstruction Awareness

If there's a road blockage or protest on your route, Sawari's backend tries to route around it automatically.

### Keyboard Shortcuts

For power users: press `/` to search, `Enter` to navigate, `T` to toggle theme, `G` for GPS, `E` to explore routes, and `?` to see all shortcuts.

## The Admin Side

There's a password-protected admin dashboard where transit data is managed. Admins can:

- Add, edit, and delete bus stops, routes, vehicles, and obstructions
- Draw routes on the map by clicking stops in order
- Upload vehicle images
- Use an AI assistant to manage data with natural language (e.g., "create a stop called Balaju at 27.72, 85.30")
- See dependency relationships (which routes use a stop, which vehicles run a route)
- Review community suggestions and apply AI-extracted tasks with one click

## Community Suggestions

Anyone can submit a suggestion from the landing page — report a wrong route, a missing stop, or a fare issue. When a suggestion is submitted, AI reads the message and tries to extract a specific, actionable task from it (like "add Kalanki stop to the Basundhara-RNAC route"). If a task is found, it shows up in the admin panel ready for one-click approval. When the admin approves it, the transit data updates automatically. If the AI can't extract a clear task, the admin reviews the raw message manually.

## Data Coverage

Sawari currently covers major routes in Kathmandu Valley including operators like Nepal Yatayat, Mahanagar Yatayat, and Sajha Yatayat. Routes span from Thankot to Dhulikhel, Lagankhel to Budhanilkantha, and many more across the valley.

## No App Store Needed

Sawari runs entirely in the browser. It's built with standard web technologies (HTML, CSS, JavaScript, PHP) and can be hosted on any basic web server. All transit data is stored in simple JSON files — no database required.

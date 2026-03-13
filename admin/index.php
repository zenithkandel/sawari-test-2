<?php
session_start();

// Load .env
$envFile = dirname(__DIR__) . '/.env';
$env = [];
if (file_exists($envFile)) {
  foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with(trim($line), '#'))
      continue;
    if (strpos($line, '=') === false)
      continue;
    [$key, $value] = explode('=', $line, 2);
    $env[trim($key)] = trim($value);
  }
}
$adminPassword = $env['ADMIN_PASSWORD'] ?? 'sawari@111';
$groqApiKey = $env['GROQ_API_KEY'] ?? '';

// Handle logout
if (isset($_GET['logout'])) {
  session_destroy();
  header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
  exit;
}

// Handle login POST
$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
  if ($_POST['password'] === $adminPassword) {
    $_SESSION['admin_authenticated'] = true;
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
    exit;
  } else {
    $loginError = 'Incorrect password. Please try again.';
  }
}

// If not authenticated, show login page
if (empty($_SESSION['admin_authenticated'])):
  ?>
  <!doctype html>
  <html lang="en">

  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sawari Admin — Login</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="styles/main.css" />
    <style>
      body {
        background: var(--bg);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }

      .login-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 2.5rem 2rem;
        width: 100%;
        max-width: 380px;
        box-shadow: var(--shadow);
      }

      .login-logo {
        text-align: center;
        margin-bottom: 1.5rem;
        color: var(--accent);
        font-size: 1.5rem;
      }

      .login-logo i {
        font-size: 2rem;
        margin-bottom: 0.5rem;
        display: block;
      }

      .login-logo span {
        font-weight: 700;
        color: var(--text);
      }

      .login-label {
        display: block;
        color: var(--text-secondary);
        font-size: 0.8rem;
        font-weight: 500;
        margin-bottom: 0.4rem;
      }

      .login-input {
        width: 100%;
        padding: 0.6rem 0.75rem;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        font-family: var(--font);
        font-size: 0.9rem;
        outline: none;
        transition: border-color var(--transition);
      }

      .login-input:focus {
        border-color: var(--accent);
      }

      .login-btn {
        width: 100%;
        margin-top: 1.25rem;
        padding: 0.65rem;
        background: var(--accent);
        color: #fff;
        border: none;
        border-radius: var(--radius);
        font-family: var(--font);
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: background var(--transition);
      }

      .login-btn:hover {
        background: var(--accent-hover);
      }

      .login-error {
        margin-top: 1rem;
        padding: 0.5rem 0.75rem;
        background: var(--danger-bg);
        color: var(--danger);
        border-radius: var(--radius-sm);
        font-size: 0.825rem;
        text-align: center;
      }

      .login-back {
        display: block;
        text-align: center;
        margin-top: 1.25rem;
        color: var(--text-muted);
        font-size: 0.8rem;
        text-decoration: none;
        transition: color var(--transition);
      }

      .login-back:hover {
        color: var(--text-secondary);
      }
    </style>
    <script>
      const t = localStorage.getItem('sawari-admin-theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
    </script>
  </head>

  <body>
    <div class="login-card">
      <div class="login-logo">
        <i class="fa-solid fa-route"></i>
        <span>Sawari Admin</span>
      </div>
      <form method="POST">
        <label class="login-label" for="password">Password</label>
        <input class="login-input" type="password" id="password" name="password" placeholder="Enter admin password"
          autofocus required />
        <button class="login-btn" type="submit"><i class="fa-solid fa-right-to-bracket"></i> Sign In</button>
        <?php if ($loginError): ?>
          <div class="login-error"><i class="fa-solid fa-circle-exclamation"></i> <?= htmlspecialchars($loginError) ?></div>
        <?php endif; ?>
      </form>
      <a href="../" class="login-back"><i class="fa-solid fa-arrow-left"></i> Back to main site</a>
    </div>
  </body>

  </html>
  <?php exit; endif; ?>
<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sawari Admin — Map Workspace</title>

  <!-- Leaflet -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <!-- App Styles -->
  <link rel="stylesheet" href="styles/main.css" />

  <!-- Prevent theme flash -->
  <script>
    const t = localStorage.getItem('sawari-admin-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  </script>
</head>

<body>
  <!-- ===== COMMAND BAR (Top) ===== -->
  <header id="command-bar">
    <div class="cb-left">
      <button id="btn-sidebar-toggle" class="cb-icon-btn" title="Toggle sidebar (Ctrl+B)">
        <i class="fa-solid fa-bars"></i>
      </button>
      <a href="../admin/" class="cb-logo" title="Back to Admin Portal">
        <i class="fa-solid fa-route"></i>
        <span>Sawari</span>
      </a>
      <div class="cb-divider"></div>
      <div id="tool-mode-group" class="cb-btn-group">
        <button class="cb-tool-btn active" data-mode="select" title="Select mode (V)">
          <i class="fa-solid fa-arrow-pointer"></i>
          <span>Select</span>
        </button>
        <button class="cb-tool-btn" data-mode="add" title="Add mode (A)">
          <i class="fa-solid fa-plus"></i>
          <span>Add</span>
        </button>
      </div>
    </div>
    <div class="cb-center">
      <div id="add-entity-group" class="cb-btn-group" style="display: none">
        <button class="cb-entity-btn" data-entity="stop" title="Add Stop (S)">
          <i class="fa-solid fa-location-dot"></i>
          <span>Stop</span>
        </button>
        <button class="cb-entity-btn" data-entity="route" title="Add Route (R)">
          <i class="fa-solid fa-route"></i>
          <span>Route</span>
        </button>
        <button class="cb-entity-btn" data-entity="vehicle" title="Add Vehicle (W)">
          <i class="fa-solid fa-bus"></i>
          <span>Vehicle</span>
        </button>
        <button class="cb-entity-btn" data-entity="obstruction" title="Add Obstruction (O)">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Obstruction</span>
        </button>
      </div>
      <button id="btn-search" class="cb-search-btn" title="Search (Ctrl+K)">
        <i class="fa-solid fa-magnifying-glass"></i>
        <span>Search entities...</span>
        <kbd>Ctrl+K</kbd>
      </button>
    </div>
    <div class="cb-right">
      <button id="btn-ai-assistant" class="cb-icon-btn ai-glow" title="AI Assistant (Ctrl+I)">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
      </button>
      <div class="cb-divider"></div>
      <button id="btn-theme-toggle" class="cb-icon-btn" title="Toggle light/dark theme">
        <i class="fa-solid fa-sun"></i>
      </button>
      <div class="cb-divider"></div>
      <button id="btn-undo" class="cb-icon-btn" title="Undo (Ctrl+Z)" disabled>
        <i class="fa-solid fa-rotate-left"></i>
      </button>
      <button id="btn-redo" class="cb-icon-btn" title="Redo (Ctrl+Y)" disabled>
        <i class="fa-solid fa-rotate-right"></i>
      </button>
      <div class="cb-divider"></div>
      <button id="btn-delete" class="cb-icon-btn danger" title="Delete selected (Del)" disabled>
        <i class="fa-solid fa-trash"></i>
      </button>
      <div class="cb-divider"></div>
      <a href="?logout=1" class="cb-icon-btn" title="Logout">
        <i class="fa-solid fa-right-from-bracket"></i>
      </a>
    </div>
  </header>

  <!-- ===== MAIN WORKSPACE ===== -->
  <div id="workspace">
    <!-- Left rail: Layer panel -->
    <aside id="layer-panel" class="panel">
      <div class="panel-header">
        <h3>Layers</h3>
      </div>
      <div class="panel-body">
        <div class="layer-group">
          <label class="layer-toggle">
            <input type="checkbox" data-layer="stops" checked />
            <span class="layer-swatch" style="background: #1d4ed8"></span>
            <span class="layer-name">Stops</span>
            <span class="layer-count" data-count="stops">0</span>
          </label>
          <label class="layer-toggle">
            <input type="checkbox" data-layer="routes" checked />
            <span class="layer-swatch" style="background: #0f766e"></span>
            <span class="layer-name">Routes</span>
            <span class="layer-count" data-count="routes">0</span>
          </label>
          <label class="layer-toggle">
            <input type="checkbox" data-layer="vehicles" checked />
            <span class="layer-swatch" style="background: #b45309"></span>
            <span class="layer-name">Vehicles</span>
            <span class="layer-count" data-count="vehicles">0</span>
          </label>
          <label class="layer-toggle">
            <input type="checkbox" data-layer="obstructions" checked />
            <span class="layer-swatch" style="background: #dc2626"></span>
            <span class="layer-name">Obstructions</span>
            <span class="layer-count" data-count="obstructions">0</span>
          </label>
        </div>

        <div class="panel-section">
          <h4>Quick Filters</h4>
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="active">Active Only</button>
          <button class="filter-btn" data-filter="moving">
            Moving Vehicles
          </button>
        </div>

        <div class="panel-section">
          <h4>Stats</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value" id="stat-stops">0</span>
              <span class="stat-label">Stops</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-routes">0</span>
              <span class="stat-label">Routes</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-vehicles">0</span>
              <span class="stat-label">Vehicles</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-obstructions">0</span>
              <span class="stat-label">Issues</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Center: Map canvas -->
    <main id="map-container">
      <div id="map"></div>
      <div id="map-crosshair" style="display: none">
        <i class="fa-solid fa-crosshairs"></i>
      </div>
      <div id="map-mode-hint" style="display: none"></div>
    </main>

    <!-- Right: Inspector panel -->
    <aside id="inspector-panel" class="panel">
      <div class="panel-header">
        <h3 id="inspector-title">Inspector</h3>
        <button id="btn-close-inspector" class="cb-icon-btn" title="Close (Esc)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div id="inspector-body" class="panel-body">
        <div class="inspector-empty">
          <i class="fa-solid fa-arrow-pointer"></i>
          <p>
            Select an object on the map to inspect and edit its properties.
          </p>
        </div>
      </div>
    </aside>
  </div>

  <!-- ===== STATUS STRIP (Bottom) ===== -->
  <footer id="status-strip">
    <div class="status-left">
      <span id="status-mode"><i class="fa-solid fa-arrow-pointer"></i> Select Mode</span>
      <span class="status-divider">|</span>
      <span id="status-coords">--</span>
    </div>
    <div class="status-center" id="status-actions"></div>
    <div class="status-right">
      <span id="status-sync" class="status-sync synced">
        <i class="fa-solid fa-circle"></i> Synced
      </span>
    </div>
  </footer>

  <!-- ===== SEARCH MODAL ===== -->
  <div id="search-modal" class="modal-backdrop" style="display: none">
    <div class="search-dialog">
      <div class="search-input-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="search-input" placeholder="Search stops, routes, vehicles..." autocomplete="off" />
        <kbd>Esc</kbd>
      </div>
      <div id="search-results" class="search-results"></div>
    </div>
  </div>

  <!-- ===== AI ASSISTANT MODAL ===== -->
  <div id="ai-modal" class="modal-backdrop" style="display: none">
    <div class="ai-dialog">
      <div class="ai-dialog-header">
        <div class="ai-dialog-title">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span>AI Assistant</span>
        </div>
        <button id="ai-modal-close" class="cb-icon-btn"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div id="ai-chat-log" class="ai-chat-log">
        <div class="ai-welcome">
          <p>I can help you manage your transit data. Try:</p>
          <div class="ai-examples">
            <button class="ai-example-btn">Add a stop called New Baneshwor</button>
            <button class="ai-example-btn">Show all vehicles on Lagankhel route</button>
            <button class="ai-example-btn">Which routes pass through Ratnapark?</button>
            <button class="ai-example-btn">How many active obstructions are there?</button>
          </div>
        </div>
      </div>
      <div class="ai-input-area">
        <input type="text" id="ai-chat-input" placeholder="Ask AI to do something..." autocomplete="off" />
        <button id="ai-chat-send" class="ai-chat-send-btn" title="Send">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  </div>

  <!-- ===== CONTEXT MENU ===== -->
  <div id="context-menu" class="context-menu" style="display: none"></div>

  <!-- ===== CONFIRM DIALOG ===== -->
  <div id="confirm-backdrop" class="modal-backdrop" style="display: none">
    <div class="confirm-dialog">
      <div class="confirm-icon">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 id="confirm-title">Confirm</h3>
      <p id="confirm-message"></p>
      <div id="confirm-deps"></div>
      <div class="confirm-actions">
        <button id="confirm-cancel" class="btn btn-ghost">Cancel</button>
        <button id="confirm-ok" class="btn btn-danger">Delete</button>
        <button id="confirm-force" class="btn btn-warn" style="display: none">
          Force Delete
        </button>
      </div>
    </div>
  </div>

  <!-- ===== TOAST CONTAINER ===== -->
  <div id="toast-container"></div>

  <!-- ===== APPLICATION SCRIPTS ===== -->
  <script>const GROQ_API_KEY = <?= json_encode($groqApiKey) ?>;</script>
  <script src="services/api-client.js"></script>
  <script src="state/store.js"></script>
  <script src="state/history.js"></script>
  <script src="state/commands.js"></script>
  <script src="map/map-engine.js"></script>
  <script src="map/layer-manager.js"></script>
  <script src="map/draw-tools.js"></script>
  <script src="map/selection-tools.js"></script>
  <script src="features/stops/stops.js"></script>
  <script src="features/routes/routes.js"></script>
  <script src="features/vehicles/vehicles.js"></script>
  <script src="features/obstructions/obstructions.js"></script>
  <script src="components/command-bar/command-bar.js"></script>
  <script src="components/layer-panel/layer-panel.js"></script>
  <script src="components/inspector/inspector.js"></script>
  <script src="components/notifications/notifications.js"></script>
  <script src="components/ai-assistant/ai-assistant.js"></script>
  <script src="app.js"></script>
</body>

</html>
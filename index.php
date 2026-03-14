<?php
// Sawari - Public Transit Navigator
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT

$envFile = __DIR__ . '/.env';
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
$groqApiKey = $env['GROQ_API_KEY'] ?? '';
?>
<!doctype html>
<html lang="en" data-theme="dark">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0f1117" />
  <title>Sawari - Public Transit Navigator</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <link rel="stylesheet" href="style.css" />
  <script>
    const t = localStorage.getItem('sawari-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  </script>
</head>

<body>
  <div id="map"></div>

  <div id="search-panel">
    <div class="panel-header">
      <div class="panel-heading">
        <h1><i class="fa-solid fa-route"></i> Sawari</h1>
        <p>Public transit navigator</p>
      </div>
      <button class="panel-icon-btn" id="btn-theme-toggle" title="Toggle theme">
        <i class="fa-solid fa-sun"></i>
      </button>
      <button class="panel-icon-btn" id="btn-explore" title="Explore routes">
        <i class="fa-solid fa-compass"></i>
      </button>
      <button class="panel-icon-btn" id="btn-collapse" title="Collapse panel">
        <i class="fa-solid fa-chevron-up"></i>
      </button>
      <a href="admin/" class="panel-icon-btn admin-link"><i class="fa-solid fa-gear"></i></a>
    </div>

    <div class="search-body">
      <div class="ai-prompt-group">
        <div class="input-group ai-input-group">
          <span class="input-icon ai"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
          <input type="text" id="input-ai-prompt" placeholder="e.g. take me from bagbazar to basundhara"
            autocomplete="off" />
          <button class="pick-btn ai-send-btn" id="btn-ai-extract" title="Extract locations with AI">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
        <div class="ai-status hidden" id="ai-status"></div>
      </div>

      <div class="ai-divider"><span>or enter manually</span></div>

      <div class="input-group">
        <span class="input-icon start"><i class="fa-solid fa-circle-dot"></i></span>
        <input type="text" id="input-start" placeholder="Starting location" autocomplete="off" />
        <button class="pick-btn" id="btn-pick-start" title="Pick on map">
          <i class="fa-solid fa-location-crosshairs"></i>
        </button>
        <div class="suggestions-dropdown hidden" id="suggestions-start"></div>
      </div>

      <div class="input-group">
        <span class="input-icon end"><i class="fa-solid fa-flag-checkered"></i></span>
        <input type="text" id="input-end" placeholder="Destination" autocomplete="off" />
        <button class="pick-btn" id="btn-pick-end" title="Pick on map">
          <i class="fa-solid fa-location-crosshairs"></i>
        </button>
        <div class="suggestions-dropdown hidden" id="suggestions-end"></div>
      </div>

      <div class="search-actions">
        <button class="btn" id="btn-swap" title="Swap start and end">
          <i class="fa-solid fa-arrows-rotate"></i>
        </button>
        <button class="btn btn-primary" id="btn-navigate">
          <i class="fa-solid fa-route"></i> Navigate
        </button>
        <button class="btn" id="btn-clear" title="Clear">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="search-utility">
        <div class="input-group utility-search-group">
          <span class="input-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
          <input type="text" id="input-global-search" placeholder="Search stops or routes" autocomplete="off" />
          <button class="pick-btn" id="btn-clear-global" title="Clear search">
            <i class="fa-solid fa-eraser"></i>
          </button>
          <div class="suggestions-dropdown hidden" id="suggestions-global"></div>
        </div>

        <details class="tools-submenu">
          <summary>
            <i class="fa-solid fa-sliders"></i>
            Map tools
          </summary>
          <div class="toggle-grid">
            <label class="toggle-item" for="toggle-routes">
              <span>Routes</span>
              <input type="checkbox" id="toggle-routes" checked />
              <span class="toggle-slider"></span>
            </label>
            <label class="toggle-item" for="toggle-stops">
              <span>Stops</span>
              <input type="checkbox" id="toggle-stops" checked />
              <span class="toggle-slider"></span>
            </label>
            <label class="toggle-item" for="toggle-vehicles">
              <span>Vehicles</span>
              <input type="checkbox" id="toggle-vehicles" checked />
              <span class="toggle-slider"></span>
            </label>
            <label class="toggle-item" for="toggle-follow-gps">
              <span>Follow GPS</span>
              <input type="checkbox" id="toggle-follow-gps" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </details>

        <p class="shortcut-hint">
          Press <strong>Enter</strong> to navigate, <strong>Esc</strong> to
          cancel map pick, or right-click the map for quick start/end.
        </p>
      </div>

      <p id="search-status" class="status-msg">
        Pick your start and destination on the map.
      </p>
    </div>
  </div>

  <!-- Explore Routes Panel -->
  <aside id="explore-panel" class="explore-panel hidden">
    <div class="explore-header">
      <h2><i class="fa-solid fa-compass"></i> Explore Routes</h2>
      <button class="panel-icon-btn" id="btn-close-explore" title="Close">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="explore-search">
      <input type="text" id="explore-filter" placeholder="Filter routes..." autocomplete="off" />
    </div>
    <div id="explore-list" class="explore-list"></div>
  </aside>

  <aside id="route-sidebar" class="route-sidebar hidden">
    <div class="route-sidebar-header">
      <div>
        <h2>Route Details</h2>
        <p id="route-sidebar-subtitle">Live trip guidance</p>
      </div>
      <div class="route-sidebar-actions">
        <button class="btn btn-sm" id="btn-share-route" title="Copy journey summary">
          <i class="fa-solid fa-share-nodes"></i>
        </button>
        <button class="btn btn-sm" id="btn-recenter-route" title="Recenter route">
          <i class="fa-solid fa-bullseye"></i>
        </button>
        <button class="btn btn-sm" id="btn-reset-focus" title="Show all map info">
          <i class="fa-solid fa-layer-group"></i>
        </button>
        <button class="btn btn-sm" id="btn-close-sidebar" title="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
    <div id="journey-results" class="hidden"></div>
  </aside>

  <div id="live-panel">
    <button class="btn btn-sm" id="btn-gps">
      <i class="fa-solid fa-location-arrow"></i> GPS
    </button>
    <span class="gps-info" id="gps-status">GPS off</span>
    <button class="btn btn-sm" id="btn-center-gps" title="Center on my location">
      <i class="fa-solid fa-crosshairs"></i>
    </button>
    <button class="btn btn-sm hidden" id="btn-nearby-stops" title="Show nearby stops">
      <i class="fa-solid fa-map-pin"></i> Nearby
    </button>
    <button class="btn btn-sm btn-success hidden" id="btn-use-gps-start" title="Use GPS as start location">
      <i class="fa-solid fa-circle-dot"></i> Use as Start
    </button>
  </div>

  <!-- Nearby Stops Panel -->
  <aside id="nearby-panel" class="nearby-panel hidden">
    <div class="nearby-header">
      <h3><i class="fa-solid fa-map-pin"></i> Nearby Stops</h3>
      <button class="panel-icon-btn" id="btn-close-nearby"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div id="nearby-list" class="nearby-list"></div>
  </aside>

  <!-- Stats Bar -->
  <div id="stats-bar" class="stats-bar">
    <span id="stats-clock"><i class="fa-regular fa-clock"></i> --:--</span>
    <span class="stats-divider"></span>
    <span id="stats-stops"><i class="fa-solid fa-bus"></i> -- stops</span>
    <span class="stats-divider"></span>
    <span id="stats-routes"><i class="fa-solid fa-route"></i> -- routes</span>
    <span class="stats-divider"></span>
    <span id="stats-vehicles"><i class="fa-solid fa-van-shuttle"></i> -- live</span>
  </div>

  <!-- Keyboard Shortcuts Modal -->
  <div id="shortcuts-modal" class="shortcuts-modal hidden">
    <div class="shortcuts-backdrop"></div>
    <div class="shortcuts-content">
      <div class="shortcuts-header">
        <h3><i class="fa-solid fa-keyboard"></i> Keyboard Shortcuts</h3>
        <button class="panel-icon-btn" id="btn-close-shortcuts"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="shortcuts-grid">
        <div class="shortcut-row"><kbd>/</kbd><span>Focus search</span></div>
        <div class="shortcut-row"><kbd>?</kbd><span>Show shortcuts</span></div>
        <div class="shortcut-row"><kbd>Enter</kbd><span>Navigate</span></div>
        <div class="shortcut-row"><kbd>Esc</kbd><span>Cancel / close</span></div>
        <div class="shortcut-row"><kbd>T</kbd><span>Toggle theme</span></div>
        <div class="shortcut-row"><kbd>E</kbd><span>Explore routes</span></div>
        <div class="shortcut-row"><kbd>G</kbd><span>Toggle GPS</span></div>
        <div class="shortcut-row"><kbd>N</kbd><span>Nearby stops</span></div>
      </div>
    </div>
  </div>

  <div id="toast-container"></div>

  <template id="tpl-vehicle-bus">
    <svg viewBox="0 0 72 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="10" width="60" height="22" rx="8" fill="__COLOR__" stroke="#0f172a" stroke-width="2" />
      <rect x="11" y="14" width="11" height="8" rx="2" fill="#e0f2fe" />
      <rect x="24" y="14" width="11" height="8" rx="2" fill="#e0f2fe" />
      <rect x="37" y="14" width="11" height="8" rx="2" fill="#e0f2fe" />
      <rect x="50" y="14" width="9" height="8" rx="2" fill="#e0f2fe" />
      <rect x="58" y="23" width="5" height="6" rx="1.5" fill="#f8fafc" />
      <circle cx="20" cy="33" r="5.5" fill="#111827" />
      <circle cx="20" cy="33" r="2.5" fill="#d1d5db" />
      <circle cx="52" cy="33" r="5.5" fill="#111827" />
      <circle cx="52" cy="33" r="2.5" fill="#d1d5db" />
    </svg>
  </template>

  <template id="tpl-vehicle-micro">
    <svg viewBox="0 0 68 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M11 26v-8c0-4 3-7 7-7h20c3 0 6 1 8 4l6 7h4c2 0 4 2 4 4v2c0 2-2 4-4 4h-3a6 6 0 0 1-12 0H27a6 6 0 0 1-12 0h-1c-2 0-3-1-3-3z"
        fill="__COLOR__" stroke="#0f172a" stroke-width="2" />
      <rect x="19" y="14" width="10" height="7" rx="2" fill="#e0f2fe" />
      <rect x="31" y="14" width="10" height="7" rx="2" fill="#e0f2fe" />
      <rect x="43" y="16" width="8" height="6" rx="2" fill="#e0f2fe" />
      <circle cx="21" cy="31" r="5.5" fill="#111827" />
      <circle cx="21" cy="31" r="2.5" fill="#d1d5db" />
      <circle cx="47" cy="31" r="5.5" fill="#111827" />
      <circle cx="47" cy="31" r="2.5" fill="#d1d5db" />
    </svg>
  </template>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>const GROQ_API_KEY = <?= json_encode($groqApiKey) ?>;</script>
  <script src="routing.js"></script>
  <script src="app.js"></script>
</body>

</html>
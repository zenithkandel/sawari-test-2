<?php
// Sawari - Landing Page
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
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sawari — Kathmandu Public Transit</title>
  <meta name="description"
    content="Navigate Kathmandu's bus routes, micro routes, and tempo lines. Plan your journey across the valley." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Inter:wght@400;500;600&display=swap"
    rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <link rel="stylesheet" href="landing.css" />
</head>

<body>
  <!-- Masthead -->
  <header class="masthead">
    <div class="masthead-rule"></div>
    <div class="masthead-inner">
      <div class="masthead-date"><?= date('l, F j, Y') ?></div>
      <h1 class="masthead-title">Sawari</h1>
      <div class="masthead-subtitle">The Kathmandu Valley Transit Companion</div>
    </div>
    <div class="masthead-rule"></div>
  </header>

  <!-- Navigation -->
  <nav class="nav-bar">
    <a href="#about">About</a>
    <span class="nav-dot"></span>
    <a href="#how-it-works">How It Works</a>
    <span class="nav-dot"></span>
    <a href="#gallery">The Valley</a>
    <span class="nav-dot"></span>
    <a href="#ask">Ask Sawari</a>
    <span class="nav-dot"></span>
    <a href="index.php" class="nav-cta">Open Navigator</a>
  </nav>

  <!-- Hero -->
  <section class="hero">
    <div class="hero-grid">
      <div class="hero-main">
        <figure class="hero-figure">
          <img src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&q=80"
            alt="A public bus on the streets of Kathmandu" loading="eager" />
          <figcaption>A Sajha Yatayat bus navigating the narrow streets of old Kathmandu, near Asan. Photograph via
            Unsplash.</figcaption>
        </figure>
      </div>
      <div class="hero-sidebar">
        <article class="hero-lead">
          <h2>Every Bus. Every Stop. One Search Away.</h2>
          <p>
            Kathmandu's public transit network is vast, chaotic, and deeply human.
            Conductors shout destinations from rattling doorways. Routes twist through
            ancient lanes and ring roads alike. For locals and visitors, the question
            is always the same: <em>which bus do I take?</em>
          </p>
          <p>
            Sawari answers that question. Type where you are and where you want to go.
            The system finds bus routes, walking connections, transfer points, and
            estimated fares — all without downloading an app or creating an account.
          </p>
          <a href="index.php" class="btn-launch">Plan a Journey &rarr;</a>
        </article>
        <figure class="hero-side-fig">
          <img src="https://images.unsplash.com/photo-1588975903078-6535c1e5d7e1?w=400&q=80"
            alt="Traditional Nepali architecture in Bhaktapur" loading="eager" />
          <figcaption>Bhaktapur Durbar Square, a short bus ride from Kathmandu.</figcaption>
        </figure>
      </div>
    </div>
  </section>

  <div class="divider-ornament">&#10053;</div>

  <!-- About -->
  <section id="about" class="section">
    <div class="section-columns">
      <div class="col-text">
        <h2 class="section-heading">What is Sawari?</h2>
        <p>
          "Sawari" is the Nepali word for vehicle, ride, conveyance — the thing
          that carries you from one place to another. This project is a public transit
          navigator built specifically for the Kathmandu Valley, where bus route information
          has traditionally lived in the collective memory of conductors and commuters,
          never on a screen.
        </p>
        <p>
          The system maps real bus routes — Sajha Yatayat, Nepal Yatayat, Mahanagar Yatayat,
          and dozens of smaller operators running micros and tempos. It calculates walking
          distances to the nearest stops, finds connecting routes for journeys that need a
          transfer, and estimates fares based on government tariff rates.
        </p>
        <p>
          It runs in a web browser. No signup, no app store, no tracking. Just a map,
          a search box, and the accumulated route data of a valley trying to move
          seven million people every day.
        </p>
      </div>
      <div class="col-img">
        <figure>
          <img src="https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=500&q=80"
            alt="Crowded street in Kathmandu with vehicles" loading="lazy" />
          <figcaption>Rush hour near New Road, Kathmandu. The daily choreography of buses, motorcycles, and pedestrians.
          </figcaption>
        </figure>
      </div>
    </div>
  </section>

  <div class="pull-quote">
    <blockquote>"Which bus goes to Budhanilkantha?" — Every Kathmandu commuter, at least once a week.</blockquote>
  </div>

  <!-- How It Works -->
  <section id="how-it-works" class="section section-alt">
    <h2 class="section-heading center">How It Works</h2>
    <div class="steps-grid">
      <div class="step">
        <div class="step-num">I</div>
        <h3>Tell It Where</h3>
        <p>
          Type your start and destination in plain language — "Bagbazar to Basundhara" —
          or tap directly on the map. The system understands both local stop names and
          broader place names via OpenStreetMap.
        </p>
      </div>
      <div class="step">
        <div class="step-num">II</div>
        <h3>See the Route</h3>
        <p>
          Sawari finds the best bus or micro route connecting your two points. If no single
          route works, it finds a transfer — two routes that share a common stop in between.
          Walking legs are shown when stops are nearby.
        </p>
      </div>
      <div class="step">
        <div class="step-num">III</div>
        <h3>Know the Fare</h3>
        <p>
          Estimated fares follow the government tariff: Rs 20 minimum for adults, Rs 15 for
          students and elderly. Rates are calculated per kilometer after the base distance,
          rounded to the nearest five rupees, just like the conductor would charge.
        </p>
      </div>
      <div class="step">
        <div class="step-num">IV</div>
        <h3>Track Your Bus</h3>
        <p>
          Where available, live vehicle positions update every few seconds on the map.
          See which bus is closest to your boarding stop, how far away it is, and its
          estimated time of arrival.
        </p>
      </div>
    </div>
  </section>

  <!-- Gallery -->
  <section id="gallery" class="section">
    <h2 class="section-heading center">Scenes From the Valley</h2>
    <p class="section-intro">The roads, the vehicles, and the places that Sawari connects.</p>
    <div class="gallery-grid">
      <figure class="gallery-item gallery-wide">
        <img src="https://images.unsplash.com/photo-1565073182887-6bcefbe225b1?w=700&q=80"
          alt="Panoramic view of Kathmandu valley" loading="lazy" />
        <figcaption>The valley floor seen from Swayambhunath, with the city stretching toward the surrounding hills.
        </figcaption>
      </figure>
      <figure class="gallery-item">
        <img src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&q=80" alt="Nepali temple architecture"
          loading="lazy" />
        <figcaption>Patan Durbar Square. Three ancient cities, one transit network.</figcaption>
      </figure>
      <figure class="gallery-item">
        <img src="https://images.unsplash.com/photo-1592285896110-6ac0b611e93c?w=400&q=80" alt="Prayer flags in Nepal"
          loading="lazy" />
        <figcaption>Prayer flags mark passes and hilltops across the valley rim.</figcaption>
      </figure>
      <figure class="gallery-item">
        <img src="https://images.unsplash.com/photo-1609920658906-8223bd289001?w=400&q=80"
          alt="Street market in Kathmandu" loading="lazy" />
        <figcaption>Morning market near Asan, a transit hub since the Malla era.</figcaption>
      </figure>
      <figure class="gallery-item gallery-wide">
        <img src="https://images.unsplash.com/photo-1543515972-b72cb4f0b989?w=700&q=80" alt="Boudhanath Stupa"
          loading="lazy" />
        <figcaption>Boudhanath, the great stupa. Several bus routes circle its perimeter.</figcaption>
      </figure>
    </div>
  </section>

  <div class="divider-ornament">&#10053;</div>

  <!-- Features (editorial style, not stats) -->
  <section class="section section-alt">
    <h2 class="section-heading center">What You Can Do</h2>
    <div class="features-editorial">
      <div class="feature-block">
        <h3><i class="fa-solid fa-route"></i> Route Planning</h3>
        <p>Direct routes, transfer routes with shared stops, and walking fallbacks. The system tries every possible
          combination of nearby stops before giving up.</p>
      </div>
      <div class="feature-block">
        <h3><i class="fa-solid fa-ticket"></i> Fare Estimation</h3>
        <p>Based on the government tariff schedule. Regular and student/elderly rates, per-leg breakdown for transfers,
          always rounded to Rs 5 like the real thing.</p>
      </div>
      <div class="feature-block">
        <h3><i class="fa-solid fa-wand-magic-sparkles"></i> Natural Language</h3>
        <p>Type "take me from Lagankhel to Ratnapark" and the AI extracts your start and end locations. No need to know
          the exact stop names.</p>
      </div>
      <div class="feature-block">
        <h3><i class="fa-solid fa-location-arrow"></i> GPS & Nearby Stops</h3>
        <p>Turn on GPS to see where you are, which stops are within walking distance, and which routes pass through
          them.</p>
      </div>
      <div class="feature-block">
        <h3><i class="fa-solid fa-leaf"></i> Carbon Comparison</h3>
        <p>See how many grams of CO2 you save by taking the bus instead of a car. Small numbers, but they compound
          across a city of millions.</p>
      </div>
      <div class="feature-block">
        <h3><i class="fa-solid fa-moon"></i> Dark & Light Themes</h3>
        <p>Switch between dark and light map styles. The dark theme uses CARTO's dark basemap with label overlays — easy
          on the eyes at night.</p>
      </div>
    </div>
  </section>

  <!-- Ask Sawari (Chatbot) -->
  <section id="ask" class="section">
    <h2 class="section-heading center">Ask Sawari</h2>
    <p class="section-intro">Have a question about Kathmandu's transit? Ask below and get an answer.</p>
    <div class="chat-container">
      <div class="chat-log" id="chat-log">
        <div class="chat-msg assistant">
          <div class="chat-avatar"><i class="fa-solid fa-bus"></i></div>
          <div class="chat-bubble">
            Namaste! I'm Sawari's assistant. Ask me anything about Kathmandu's bus routes,
            fares, stops, or how to get somewhere in the valley. I'll do my best to help.
          </div>
        </div>
      </div>
      <form class="chat-input-area" id="chat-form">
        <input type="text" id="chat-input" placeholder="e.g. How do I get from Kalanki to Chabahil?"
          autocomplete="off" />
        <button type="submit" id="chat-send" title="Send">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </form>
    </div>
  </section>

  <!-- Footer -->
  <footer class="page-footer">
    <div class="footer-rule"></div>
    <div class="footer-inner">
      <div class="footer-left">
        <p class="footer-brand">Sawari</p>
        <p class="footer-tagline">A public transit navigator for the Kathmandu Valley.</p>
        <p class="footer-tagline">Open source under the MIT License.</p>
      </div>
      <div class="footer-right">
        <p>Built by <a href="https://zenithkandel.com.np" target="_blank" rel="noopener">Zenith Kandel</a></p>
        <p class="footer-links">
          <a href="index.php">Navigator</a> &middot;
          <a href="admin/">Admin</a> &middot;
          <a href="https://zenithkandel.com.np" target="_blank" rel="noopener">Portfolio</a>
        </p>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; <?= date('Y') ?> Zenith Kandel. All rights reserved.</p>
    </div>
  </footer>

  <script>const GROQ_API_KEY = <?= json_encode($groqApiKey) ?>;</script>
  <script src="landing.js"></script>
</body>

</html>
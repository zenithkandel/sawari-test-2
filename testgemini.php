<?php
// ============================================================
// Sawari - Location extraction via Nominatim
// Author: Zenith Kandel — https://zenithkandel.com.np
// ============================================================
header("Content-Type: application/json");

if (isset($_POST['prompt'])) {
    $prompt = strtolower($_POST['prompt']);

    // Extract locations
    $from = $to = null;
    if (preg_match('/from\s+(.*?)\s+to\s+(.*)/', $prompt, $matches)) {
        $from = trim($matches[1]);
        $to = trim($matches[2]);
    } else {
        echo json_encode([
            "error" => "Could not detect 'from X to Y'. Please write like 'from Bagbazar to Basundhara'."
        ]);
        exit;
    }

    // Geocode function
    function geocode($place)
    {
        $url = "https://nominatim.openstreetmap.org/search?format=json&q=" . urlencode($place);
        $opts = ["http" => ["header" => "User-Agent: PHP-Geocoder\r\n"]];
        $context = stream_context_create($opts);
        $response = file_get_contents($url, false, $context);
        if (!$response)
            return null;
        $data = json_decode($response, true);
        if (isset($data[0])) {
            return ["name" => $place, "lat" => $data[0]['lat'], "lon" => $data[0]['lon']];
        }
        return null;
    }

    $start = geocode($from);
    $end = geocode($to);

    if (!$start || !$end) {
        echo json_encode(["error" => "One or both locations not found."]);
        exit;
    }

    echo json_encode([
        "prompt" => $prompt,
        "from" => $start,
        "to" => $end
    ]);
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Location Extractor</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 50px;
        }

        h1 {
            color: #0f766e;
        }

        input[type=text] {
            width: 300px;
            padding: 10px;
            font-size: 16px;
        }

        button {
            padding: 10px 20px;
            font-size: 16px;
            background: #0f766e;
            color: white;
            border: none;
            cursor: pointer;
        }

        button:hover {
            background: #115e52;
        }

        pre {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            width: 90%;
            max-width: 600px;
            overflow-x: auto;
        }
    </style>
</head>

<body>
    <h1>AI Location Extractor</h1>
    <p>Write like: <strong>from Bagbazar to Basundhara</strong></p>
    <input type="text" id="prompt" placeholder="Enter your route..." />
    <button onclick="getLocation()">Get Coordinates</button>
    <pre id="output">Results will appear here...</pre>

    <script>
        function getLocation() {
            const prompt = document.getElementById('prompt').value;
            if (!prompt) { alert("Please enter a route."); return; }

            const formData = new FormData();
            formData.append('prompt', prompt);

            fetch("", { method: "POST", body: formData })
                .then(res => res.json())
                .then(data => {
                    document.getElementById('output').textContent = JSON.stringify(data, null, 2);
                })
                .catch(err => {
                    document.getElementById('output').textContent = "Error: " + err;
                });
        }
    </script>
</body>

</html>
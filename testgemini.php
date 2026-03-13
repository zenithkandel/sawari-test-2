<?php

$GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

function askGemini($text, $key){

    $prompt = "Extract the start and destination location from this sentence.
Return ONLY JSON like this:

{
\"start\": \"...\",
\"end\": \"...\"
}

Sentence: \"$text\"";

    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=".$key;

    $data = [
        "contents" => [
            [
                "parts" => [
                    ["text" => $prompt]
                ]
            ]
        ]
    ];

    $ch = curl_init($url);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json"
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $response = json_decode($response, true);

    $text = $response["candidates"][0]["content"]["parts"][0]["text"] ?? "";

    $text = trim($text);
    $text = str_replace(["```json","```"], "", $text);

    return json_decode($text, true);
}


function geocode($place){

    $place = urlencode($place." kathmandu");

    $url = "https://nominatim.openstreetmap.org/search?q=".$place."&format=json&limit=1";

    $opts = [
        "http" => [
            "header" => "User-Agent: sawari-test"
        ]
    ];

    $context = stream_context_create($opts);

    $result = file_get_contents($url,false,$context);

    $data = json_decode($result,true);

    if(!$data) return null;

    return [
        "lat"=>$data[0]["lat"],
        "lon"=>$data[0]["lon"]
    ];
}


$result = null;

if(isset($_POST["query"])){

    $query = $_POST["query"];

    $places = askGemini($query,$GEMINI_API_KEY);

    if($places){

        $start = geocode($places["start"]);
        $end = geocode($places["end"]);

        $result = [
            "places"=>$places,
            "coordinates"=>[
                "start"=>$start,
                "end"=>$end
            ]
        ];
    }
}

?>

<!DOCTYPE html>
<html>
<head>
<title>AI Location Parser Test</title>

<style>

body{
font-family:Arial;
background:#111;
color:white;
padding:40px;
}

input{
width:70%;
padding:12px;
font-size:16px;
}

button{
padding:12px 20px;
background:#00aaff;
border:none;
color:white;
cursor:pointer;
}

pre{
background:#222;
padding:20px;
margin-top:20px;
overflow:auto;
}

</style>

</head>

<body>

<h1>AI Route Parser Test</h1>

<p>Example: <b>I need to go from bagbazar to basundhara</b></p>

<form method="POST">

<input name="query" placeholder="Type your travel request..." required>

<button>Test</button>

</form>

<?php if($result): ?>

<h2>Result</h2>

<pre><?php echo json_encode($result,JSON_PRETTY_PRINT); ?></pre>

<?php endif; ?>

</body>
</html>

<?php
header('Content-Type: application/json');

// Paths
$dataFile = __DIR__ . '/data.json';
$uploadDir = __DIR__ . '/uploads/';

// Ensure uploads folder exists
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Ensure data.json exists
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode([
        "properties" => [],
        "activity" => []
    ]));
}

$action = $_GET['action'] ?? '';

// Authentication check for sensitive actions
$adminPassword = 'Egonabia@2022';
if (in_array($action, ['saveData', 'uploadImage'])) {
    $providedPassword = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';
    if ($providedPassword !== $adminPassword) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

switch ($action) {
    case 'getData':
        $data = file_get_contents($dataFile);
        echo $data;
        break;

    case 'saveData':
        // Read JSON payload
        $input = file_get_contents('php://input');
        $decoded = json_decode($input, true);

        if (!$decoded || !is_array($decoded) || !isset($decoded['properties']) || !is_array($decoded['properties'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON structure']);
            exit;
        }

        // Save back to file
        file_put_contents($dataFile, json_encode($decoded, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        break;

    case 'uploadImage':
        // Handle direct file upload
        if (!isset($_FILES['file'])) {
            http_response_code(400);
            echo json_encode(['error' => 'No file uploaded']);
            exit;
        }

        $file = $_FILES['file'];
        
        // Secure image validation using magic bytes
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime_type = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($mime_type, $validTypes)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file type']);
            exit;
        }

        // Generate unique name
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $newName = uniqid('img_') . '.' . $ext;
        $destPath = $uploadDir . $newName;

        if (move_uploaded_file($file['tmp_name'], $destPath)) {
            echo json_encode(['url' => 'uploads/' . $newName]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save file']);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        break;
}

<?php
session_start();
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
$adminPasswordHash = '7b449ef509eb63fc0dbccf41c88b79d1307004c453bbd5fff97fd53f1b066ad4';

if ($action === 'login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $providedPassword = $input['password'] ?? '';
    $providedHash = hash('sha256', $providedPassword);

    if (!hash_equals($adminPasswordHash, $providedHash)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $_SESSION['prism_admin'] = true;
    echo json_encode(['success' => true]);
    exit;
}

if (in_array($action, ['saveData', 'uploadImage', 'uploadVideo'])) {
    if (empty($_SESSION['prism_admin'])) {
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

    case 'uploadVideo':
        if (!isset($_FILES['file'])) {
            http_response_code(400);
            echo json_encode(['error' => 'No file uploaded']);
            exit;
        }

        $file = $_FILES['file'];

        if (!empty($file['error']) && $file['error'] !== UPLOAD_ERR_OK) {
            $errMap = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds server upload_max_filesize. Compress the video or split into shorter clips.',
                UPLOAD_ERR_FORM_SIZE => 'File exceeds the form size limit.',
                UPLOAD_ERR_PARTIAL => 'File was only partially uploaded. Try again.',
                UPLOAD_ERR_NO_TMP_DIR => 'Server tmp directory missing.',
                UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk.'
            ];
            http_response_code(400);
            echo json_encode(['error' => $errMap[$file['error']] ?? 'Upload error']);
            exit;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime_type = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'];
        if (!in_array($mime_type, $validTypes)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid video type. Allowed: MP4, WebM, MOV, MKV, OGG. Detected: ' . $mime_type]);
            exit;
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) ?: 'mp4';
        $newName = uniqid('vid_') . '.' . $ext;
        $destPath = $uploadDir . $newName;

        if (move_uploaded_file($file['tmp_name'], $destPath)) {
            echo json_encode(['url' => 'uploads/' . $newName]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save video file']);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        break;
}

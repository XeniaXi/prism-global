<?php
declare(strict_types=1);

$secureCookie = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'httponly' => true,
    'secure' => $secureCookie,
    'samesite' => 'Strict',
    'path' => '/'
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$dataFile = __DIR__ . '/data.json';
$uploadDir = __DIR__ . '/uploads/';
$privateDir = dirname(__DIR__) . '/prism-private';
$auditFile = $privateDir . '/audit-log.jsonl';
$legacyPasswordHash = '7b449ef509eb63fc0dbccf41c88b79d1307004c453bbd5fff97fd53f1b066ad4';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    respond(['error' => 'Upload storage is unavailable'], 500);
}
if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
    respond(['error' => 'Private audit storage is unavailable'], 500);
}
if (!is_file($dataFile)) {
    file_put_contents($dataFile, json_encode([
        'properties' => [],
        'gallery' => [],
        'videos' => [],
        'activity' => []
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function input_json(): array
{
    $decoded = json_decode((string) file_get_contents('php://input'), true);
    return is_array($decoded) ? $decoded : [];
}

function request_id(): string
{
    static $id = '';
    if ($id === '') {
        try {
            $id = bin2hex(random_bytes(8));
        } catch (Throwable $e) {
            $id = uniqid('req_', true);
        }
    }
    return $id;
}

function audit_event(string $event, array $details = [], ?string $actor = null): void
{
    global $auditFile;
    $safe = [];
    foreach ($details as $key => $value) {
        if (is_scalar($value) || $value === null) {
            $safe[(string) $key] = is_string($value) ? substr($value, 0, 500) : $value;
        }
    }
    $record = [
        'id' => request_id(),
        'time' => gmdate(DATE_ATOM),
        'actor' => $actor ?? ($_SESSION['prism_admin_user'] ?? 'anonymous'),
        'authMode' => $_SESSION['prism_admin_mode'] ?? 'none',
        'event' => $event,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'userAgent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'), 0, 300),
        'details' => $safe
    ];
    @file_put_contents(
        $auditFile,
        json_encode($record, JSON_UNESCAPED_SLASHES) . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
}



function require_admin(bool $csrf = false): void
{
    if (empty($_SESSION['prism_admin']) || empty($_SESSION['prism_admin_user'])) {
        respond(['error' => 'Authentication required'], 401);
    }
    if ($csrf) {
        $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        $expected = (string) ($_SESSION['prism_csrf'] ?? '');
        if ($provided === '' || $expected === '' || !hash_equals($expected, $provided)) {
            audit_event('security.csrf_rejected');
            respond(['error' => 'Your admin session is stale. Sign in again.'], 403);
        }
    }
}

function read_data(): array
{
    global $dataFile;
    $decoded = json_decode((string) @file_get_contents($dataFile), true);
    return is_array($decoded) ? $decoded : [
        'properties' => [],
        'gallery' => [],
        'videos' => [],
        'activity' => []
    ];
}

function data_revision(): string
{
    global $dataFile;
    return hash_file('sha256', $dataFile) ?: '';
}

function mutate_data(callable $mutator): array
{
    global $dataFile;
    $handle = fopen($dataFile, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('Unable to lock data storage');
    }

    rewind($handle);
    $raw = (string) stream_get_contents($handle);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $data = ['properties' => [], 'gallery' => [], 'videos' => [], 'activity' => []];
    }

    try {
        $result = $mutator($data, hash('sha256', $raw));
        $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            throw new RuntimeException('Unable to encode data');
        }
        rewind($handle);
        ftruncate($handle, 0);
        if (fwrite($handle, $encoded) === false) {
            throw new RuntimeException('Unable to write data');
        }
        fflush($handle);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }

    return is_array($result) ? $result : [];
}

function valid_media_source(string $source): bool
{
    if (preg_match('#^uploads/[A-Za-z0-9._-]+$#', $source)) {
        return true;
    }
    return filter_var($source, FILTER_VALIDATE_URL) !== false
        && strtolower((string) parse_url($source, PHP_URL_SCHEME)) === 'https';
}

function check_upload_error(array $file): void
{
    $code = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($code === UPLOAD_ERR_OK) {
        return;
    }
    $messages = [
        UPLOAD_ERR_INI_SIZE => 'File exceeds the server upload limit.',
        UPLOAD_ERR_FORM_SIZE => 'File exceeds the form size limit.',
        UPLOAD_ERR_PARTIAL => 'File was only partially uploaded.',
        UPLOAD_ERR_NO_FILE => 'No file uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 'Server temporary directory is missing.',
        UPLOAD_ERR_CANT_WRITE => 'Server could not write the file.',
        UPLOAD_ERR_EXTENSION => 'A server extension stopped the upload.'
    ];
    audit_event('upload.failed', ['code' => $code, 'name' => (string) ($file['name'] ?? '')]);
    respond(['error' => $messages[$code] ?? 'Upload failed.'], 400);
}

$action = (string) ($_GET['action'] ?? '');

if ($action === 'login') {
    $input = input_json();
    $password = (string) ($input['password'] ?? '');

    if ($password === '') {
        audit_event('auth.login_failed');
        respond(['error' => 'Incorrect password'], 401);
    }

    $attempts = (int) ($_SESSION['prism_login_attempts'] ?? 0);
    $lastAttempt = (int) ($_SESSION['prism_login_last'] ?? 0);
    if ($attempts >= 5 && time() - $lastAttempt < 900) {
        audit_event('auth.rate_limited');
        respond(['error' => 'Too many attempts. Try again later.'], 429);
    }

    if (!hash_equals($legacyPasswordHash, hash('sha256', $password))) {
        $_SESSION['prism_login_attempts'] = $attempts + 1;
        $_SESSION['prism_login_last'] = time();
        audit_event('auth.login_failed');
        respond(['error' => 'Incorrect password'], 401);
    }

    session_regenerate_id(true);
    $_SESSION['prism_admin'] = true;
    $_SESSION['prism_admin_user'] = 'shared-admin';
    $_SESSION['prism_admin_mode'] = 'shared-password';
    $_SESSION['prism_csrf'] = bin2hex(random_bytes(24));
    $_SESSION['prism_login_attempts'] = 0;
    audit_event('auth.login_success');

    respond([
        'success' => true,
        'actor' => 'Shared admin',
        'authMode' => 'shared-password',
        'csrf' => $_SESSION['prism_csrf']
    ]);
}

if ($action === 'session') {
    if (empty($_SESSION['prism_admin'])) {
        respond(['authenticated' => false], 401);
    }
    respond([
        'authenticated' => true,
        'actor' => $_SESSION['prism_admin_user'],
        'authMode' => $_SESSION['prism_admin_mode'],
        'csrf' => $_SESSION['prism_csrf']
    ]);
}

if ($action === 'logout') {
    if (!empty($_SESSION['prism_admin'])) {
        audit_event('auth.logout');
    }
    $_SESSION = [];
    session_destroy();
    respond(['success' => true]);
}

if ($action === 'getData') {
    $data = read_data();
    if (empty($_SESSION['prism_admin'])) {
        unset($data['activity']);
    }
    $data['_revision'] = data_revision();
    respond($data);
}

if ($action === 'getActivity') {
    require_admin();
    $records = [];
    if (is_file($auditFile)) {
        $lines = file($auditFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        foreach (array_slice(array_reverse($lines), 0, 200) as $line) {
            $record = json_decode($line, true);
            if (is_array($record)) {
                $records[] = $record;
            }
        }
    }
    respond(['activity' => $records]);
}

if ($action === 'listVideoUploads') {
    require_admin();
    $data = read_data();
    $attached = [];
    foreach (($data['videos'] ?? []) as $video) {
        $attached[ltrim((string) ($video['src'] ?? ''), '/')] = true;
    }

    $uploads = [];
    foreach (glob($uploadDir . 'vid_*') ?: [] as $path) {
        if (!is_file($path)) {
            continue;
        }
        $url = 'uploads/' . basename($path);
        $uploads[] = [
            'url' => $url,
            'name' => basename($path),
            'size' => filesize($path) ?: 0,
            'uploadedAt' => gmdate(DATE_ATOM, filemtime($path) ?: time()),
            'attached' => isset($attached[$url])
        ];
    }
    usort($uploads, static fn(array $a, array $b): int => strcmp($b['uploadedAt'], $a['uploadedAt']));
    respond(['uploads' => $uploads]);
}

if ($action === 'saveData') {
    require_admin(true);
    $input = input_json();
    $providedRevision = (string) ($input['_revision'] ?? '');
    unset($input['_revision']);

    if (!isset($input['properties']) || !is_array($input['properties'])) {
        respond(['error' => 'Invalid data structure'], 400);
    }

    try {
        $result = mutate_data(function (array &$data, string $lockedRevision) use ($input, $providedRevision): array {
            if ($providedRevision !== '' && !hash_equals($lockedRevision, $providedRevision)) {
                throw new UnexpectedValueException('revision_conflict');
            }
            $before = $data;
            $replacement = $input;
            $replacement['activity'] = $before['activity'] ?? [];
            $replacement['updatedAt'] = gmdate(DATE_ATOM);
            $replacement['updatedBy'] = $_SESSION['prism_admin_user'];
            $data = $replacement;
            return [
                'propertiesBefore' => count($before['properties'] ?? []),
                'propertiesAfter' => count($replacement['properties'] ?? []),
                'galleryBefore' => count($before['gallery'] ?? []),
                'galleryAfter' => count($replacement['gallery'] ?? []),
                'videosBefore' => count($before['videos'] ?? []),
                'videosAfter' => count($replacement['videos'] ?? [])
            ];
        });
    } catch (UnexpectedValueException $e) {
        audit_event('data.conflict', ['providedRevision' => $providedRevision, 'currentRevision' => data_revision()]);
        respond(['error' => 'Another admin changed the site. Reload before saving so their work is not overwritten.'], 409);
    } catch (Throwable $e) {
        audit_event('data.save_failed', ['reason' => $e->getMessage()]);
        respond(['error' => 'Server could not save data.json'], 500);
    }

    audit_event('data.saved', $result);
    respond(['success' => true, 'revision' => data_revision()]);
}

if ($action === 'upsertVideo') {
    require_admin(true);
    $input = input_json();
    $video = is_array($input['video'] ?? null) ? $input['video'] : [];
    $source = trim((string) ($video['src'] ?? ''));
    $caption = trim((string) ($video['caption'] ?? ''));
    $editId = trim((string) ($input['id'] ?? ''));

    if ($source === '' || $caption === '' || !valid_media_source($source)) {
        respond(['error' => 'A valid HTTPS video source or uploaded file and title are required'], 400);
    }

    try {
        $result = mutate_data(function (array &$data) use ($video, $source, $caption, $editId): array {
            $data['videos'] = is_array($data['videos'] ?? null) ? $data['videos'] : [];
            $record = [
                'id' => $editId !== '' ? $editId : 'vid_' . bin2hex(random_bytes(8)),
                'src' => $source,
                'caption' => $caption,
                'category' => trim((string) ($video['category'] ?? 'aerial')),
                'featured' => !empty($video['featured']),
                'poster' => trim((string) ($video['poster'] ?? '')),
                'description' => trim((string) ($video['description'] ?? '')),
                'videoType' => trim((string) ($video['videoType'] ?? 'file')),
                'updatedAt' => gmdate(DATE_ATOM),
                'updatedBy' => $_SESSION['prism_admin_user']
            ];

            $found = false;
            foreach ($data['videos'] as $index => $existing) {
                if ($editId !== '' && ($existing['id'] ?? '') === $editId) {
                    $record['createdAt'] = $existing['createdAt'] ?? gmdate(DATE_ATOM);
                    $data['videos'][$index] = array_merge($existing, $record);
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $record['createdAt'] = gmdate(DATE_ATOM);
                $data['videos'][] = $record;
            }
            $data['updatedAt'] = gmdate(DATE_ATOM);
            $data['updatedBy'] = $_SESSION['prism_admin_user'];
            return ['video' => $record, 'videos' => $data['videos'], 'created' => !$found];
        });
    } catch (Throwable $e) {
        audit_event('video.save_failed', ['caption' => $caption, 'reason' => $e->getMessage()]);
        respond(['error' => 'Server could not save the video record'], 500);
    }

    audit_event($result['created'] ? 'video.added' : 'video.updated', [
        'id' => $result['video']['id'],
        'caption' => $caption,
        'src' => $source
    ]);
    respond([
        'success' => true,
        'video' => $result['video'],
        'videos' => $result['videos'],
        'revision' => data_revision()
    ]);
}

if ($action === 'deleteVideo') {
    require_admin(true);
    $input = input_json();
    $id = trim((string) ($input['id'] ?? ''));
    if ($id === '') {
        respond(['error' => 'Video id is required'], 400);
    }

    try {
        $result = mutate_data(function (array &$data) use ($id): array {
            $data['videos'] = is_array($data['videos'] ?? null) ? $data['videos'] : [];
            $deleted = null;
            $remaining = [];
            foreach ($data['videos'] as $video) {
                if (($video['id'] ?? '') === $id) {
                    $deleted = $video;
                } else {
                    $remaining[] = $video;
                }
            }
            $data['videos'] = $remaining;
            $data['updatedAt'] = gmdate(DATE_ATOM);
            $data['updatedBy'] = $_SESSION['prism_admin_user'];
            return ['deleted' => $deleted, 'videos' => $remaining];
        });
    } catch (Throwable $e) {
        respond(['error' => 'Server could not delete the video record'], 500);
    }

    audit_event('video.deleted', [
        'id' => $id,
        'caption' => (string) ($result['deleted']['caption'] ?? ''),
        'srcPreserved' => (string) ($result['deleted']['src'] ?? '')
    ]);
    respond(['success' => true, 'videos' => $result['videos']]);
}

if ($action === 'uploadImage' || $action === 'uploadVideo') {
    require_admin(true);
    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        respond(['error' => 'No file uploaded'], 400);
    }

    $file = $_FILES['file'];
    check_upload_error($file);
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? (string) finfo_file($finfo, $file['tmp_name']) : '';
    if ($finfo) {
        finfo_close($finfo);
    }

    $isVideo = $action === 'uploadVideo';
    $types = $isVideo
        ? ['video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov', 'video/x-matroska' => 'mkv', 'video/ogg' => 'ogg']
        : ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    if (!isset($types[$mime])) {
        audit_event('upload.rejected', ['name' => (string) $file['name'], 'mime' => $mime, 'kind' => $isVideo ? 'video' : 'image']);
        respond(['error' => 'Invalid ' . ($isVideo ? 'video' : 'image') . ' type: ' . $mime], 400);
    }

    $size = (int) ($file['size'] ?? 0);
    $maxBytes = $isVideo ? 250 * 1024 * 1024 : 15 * 1024 * 1024;
    if ($size <= 0 || $size > $maxBytes) {
        audit_event('upload.rejected', ['name' => (string) $file['name'], 'size' => $size, 'kind' => $isVideo ? 'video' : 'image']);
        respond(['error' => 'File exceeds the application size limit'], 400);
    }

    $prefix = $isVideo ? 'vid_' : 'img_';
    $name = $prefix . bin2hex(random_bytes(12)) . '.' . $types[$mime];
    $destination = $uploadDir . $name;
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        audit_event('upload.failed', ['name' => (string) $file['name'], 'kind' => $isVideo ? 'video' : 'image']);
        respond(['error' => 'Server failed to save the uploaded file'], 500);
    }
    @chmod($destination, 0644);

    $url = 'uploads/' . $name;
    audit_event($isVideo ? 'video.uploaded' : 'image.uploaded', [
        'originalName' => (string) $file['name'],
        'savedAs' => $url,
        'mime' => $mime,
        'size' => $size,
        'attached' => false
    ]);
    respond(['url' => $url, 'size' => $size, 'mime' => $mime]);
}

respond(['error' => 'Invalid action'], 400);

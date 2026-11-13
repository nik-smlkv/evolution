<?php

declare(strict_types=1);

const LEAD_BODY_LIMIT = 8192;
const LEAD_COOLDOWN_MS = 10_000;
const LEAD_RATE_MAX_IPS = 2048;
const LEAD_HOUSES = ['tchaikovsky' => 'Tchaikovsky', 'vivaldi' => 'Vivaldi'];

function leadWebhookUrl(): ?string
{
    $webhook = getenv('EVOLUTION_BITRIX_WEBHOOK_URL') ?: '';
    $url = parse_url($webhook);

    if (!filter_var($webhook, FILTER_VALIDATE_URL)
        || ($url['scheme'] ?? '') !== 'https'
        || !str_ends_with($url['path'] ?? '', '/crm.lead.add.json')
        || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])
    ) {
        return null;
    }

    return $webhook;
}

function leadPlanUrl(string $value, string $house): ?string
{
    if ($value === '') {
        return '';
    }
    $url = parse_url($value);
    if ($url === false || isset($url['user']) || isset($url['pass']) || isset($url['port'])) {
        return null;
    }
    if ((isset($url['scheme']) || isset($url['host']))
        && (($url['scheme'] ?? '') !== 'https'
            || !in_array(strtolower($url['host'] ?? ''), ['evolutionresidence.rs', 'www.evolutionresidence.rs'], true))
    ) {
        return null;
    }

    $path = $url['path'] ?? '';
    if (str_starts_with($path, './')) {
        $path = substr($path, 2);
    }
    $path = '/' . ltrim($path, '/');
    $directory = '/assets/images/projects/' . $house . '/apartments/';
    if (!str_starts_with($path, $directory)
        || !preg_match('~\A(?:plans|previews)/(?:[a-z0-9_-]+/)*[a-z0-9_-]+\.(?:jpg|jpeg|png|webp|svg)\z~i', substr($path, strlen($directory)))
    ) {
        return null;
    }

    return 'https://evolutionresidence.rs' . $path;
}

function parseLeadSubmission(string $body): ?array
{
    if (strlen($body) > LEAD_BODY_LIMIT) {
        return null;
    }
    $input = json_decode($body, true, 8);
    if (!is_array($input)) {
        return null;
    }

    $kind = $input['kind'] ?? null;
    $house = $input['house'] ?? null;
    $name = $input['name'] ?? null;
    $phone = $input['phone'] ?? null;
    $email = $input['email'] ?? null;
    $property = $input['property'] ?? null;
    if (!in_array($kind, ['callback', 'price'], true)
        || ($house !== null && (!is_string($house) || !isset(LEAD_HOUSES[$house])))
        || !is_string($name) || !preg_match("/\A[\p{L}][\p{L}\p{M} .'’\-]{0,79}\z/u", trim($name))
        || !is_string($phone) || !preg_match('/\A\+?[0-9 ().-]{8,32}\z/', trim($phone))
        || !is_string($email) || strlen(trim($email)) > 254 || !filter_var(trim($email), FILTER_VALIDATE_EMAIL)
    ) {
        return null;
    }

    $name = trim($name);
    $email = trim($email);
    $phone = preg_replace('/[^+0-9]/', '', trim($phone));
    if (!preg_match('/\A\+?[0-9]{8,15}\z/', $phone)) {
        return null;
    }

    if ($kind === 'callback') {
        if ($property !== null) {
            return null;
        }
        return compact('kind', 'house', 'name', 'phone', 'email', 'property');
    }

    if ($house === null || !is_array($property)
        || !in_array($property['type'] ?? null, ['apartments', 'commercial', 'parking'], true)
    ) {
        return null;
    }
    $type = $property['type'];
    foreach (['unit', 'wing', 'floor', 'area'] as $key) {
        $value = $property[$key] ?? '';
        if (is_int($value) || is_float($value)) {
            $value = (string) $value;
        }
        if (!is_string($value) || !preg_match('~\A[\p{L}\p{M}\p{N} ./,+()\-–—−]{0,48}\z~u', trim($value))) {
            return null;
        }
        $property[$key] = trim($value);
    }
    $plan = $property['planUrl'] ?? '';
    $planUrl = is_string($plan) && strlen($plan) <= 2048 ? leadPlanUrl($plan, $house) : null;
    if ($property['unit'] === '' || $planUrl === null) {
        return null;
    }
    $property = [
        'type' => $type,
        'unit' => $property['unit'],
        'wing' => $property['wing'],
        'floor' => $property['floor'],
        'area' => $property['area'],
        'planUrl' => $planUrl,
    ];
    return compact('kind', 'house', 'name', 'phone', 'email', 'property');
}

function leadCrmFields(array $lead): array
{
    $house = LEAD_HOUSES[$lead['house'] ?? ''] ?? 'Nije izabran';
    $comments = 'Objekat: ' . $house;
    $property = $lead['property'];
    if ($property !== null && $property['type'] === 'apartments') {
        $plan = $property['planUrl'] === '' ? '' : '. Tlocrt stana na sajtu ' . $property['planUrl'];
        $comments = "Saznati cenu stana '{$comments}, Površina:{$property['area']}, "
            . "Krilo zgrade:{$property['wing']}, Sprat: {$property['floor']}, Broj stana: {$property['unit']}{$plan}'";
    } elseif ($property !== null) {
        $label = $property['type'] === 'parking' ? 'parking mesta' : 'poslovnog prostora';
        $details = [$comments];
        foreach (['wing' => 'Krilo zgrade', 'floor' => 'Sprat', 'unit' => 'Broj'] as $key => $caption) {
            if ($property[$key] !== '') {
                $details[] = $caption . ': ' . $property[$key];
            }
        }
        $comments = "Saznati cenu {$label} '" . implode(', ', $details) . "'";
    }

    return [
        'TITLE' => "Complete CRM form 'Prijava za konsultacije sa sajta (evolutionresidence.rs)'",
        'NAME' => $lead['name'],
        'PHONE' => [['VALUE' => $lead['phone'], 'VALUE_TYPE' => 'WORK']],
        'EMAIL' => [['VALUE' => $lead['email'], 'VALUE_TYPE' => 'WORK']],
        'COMMENTS' => $comments,
    ];
}

// Returns seconds until another attempt is allowed, or null if storage is unavailable.
function leadRetryAfter(string $key): ?int
{
    $directory = getenv('EVOLUTION_LEAD_RATE_LIMIT_DIR') ?: sys_get_temp_dir()
        . '/evolution-leads-' . substr(hash('sha256', __DIR__), 0, 24);
    if (!str_starts_with($directory, '/') || is_link(rtrim($directory, '/'))
        || (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory))
    ) {
        return null;
    }
    $directory = realpath($directory);
    $permissions = $directory === false ? false : @fileperms($directory);
    if ($permissions === false || ($permissions & 0077) !== 0 || !is_writable($directory)) {
        return null;
    }
    foreach ([__DIR__, $_SERVER['DOCUMENT_ROOT'] ?? ''] as $root) {
        $public = $root === '' ? false : realpath($root);
        if ($public !== false && ($directory === $public || str_starts_with($directory, rtrim($public, '/') . '/'))) {
            return null;
        }
    }

    $lockPath = $directory . '/rate.lock';
    $statePath = $directory . '/rate.json';
    if (is_link($lockPath) || (file_exists($lockPath) && !is_file($lockPath))) {
        return null;
    }
    $lock = @fopen($lockPath, 'c+b');
    if ($lock === false) {
        return null;
    }

    try {
        if (!@chmod($lockPath, 0600) || !@flock($lock, LOCK_EX)) {
            return null;
        }
        clearstatcache();
        $attempts = [];
        if (is_link($statePath) || (file_exists($statePath) && !is_file($statePath))) {
            return null;
        }
        if (is_file($statePath)) {
            $state = @file_get_contents($statePath, false, null, 0, 262145);
            $attempts = $state === false ? null : json_decode($state, true, 4);
            if (!is_array($attempts)) {
                return null;
            }
        }

        $now = (int) floor(microtime(true) * 1000);
        $attempts = array_filter($attempts, static fn ($expires) => is_int($expires) && $expires > $now);
        if (isset($attempts[$key])) {
            return (int) ceil(($attempts[$key] - $now) / 1000);
        }
        if (count($attempts) >= LEAD_RATE_MAX_IPS) {
            return (int) ceil((min($attempts) - $now) / 1000);
        }
        $attempts[$key] = $now + LEAD_COOLDOWN_MS;

        $encoded = json_encode($attempts, JSON_THROW_ON_ERROR);
        // Keep the lock on a separate file so replacing state is atomic for all workers.
        $temporary = @tempnam($directory, 'state-');
        if ($temporary === false) {
            return null;
        }
        if (dirname($temporary) !== $directory
            || @file_put_contents($temporary, $encoded) !== strlen($encoded)
            || !@rename($temporary, $statePath)
        ) {
            @unlink($temporary);
            return null;
        }

        return 0;
    } finally {
        fclose($lock);
    }
}

function postLeadJson(string $url, array $payload, array $headers): array
{
    $curl = curl_init($url);
    if ($curl === false) {
        return [0, ''];
    }
    $body = '';
    $options = [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 65536) {
                return 0;
            }
            $body .= $chunk;
            return strlen($chunk);
        },
    ];
    if (defined('CURLOPT_PROTOCOLS_STR')) {
        $options[CURLOPT_PROTOCOLS_STR] = 'https';
    } else {
        $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTPS;
    }
    if (!curl_setopt_array($curl, $options) || curl_exec($curl) !== true) {
        return [0, ''];
    }
    return [curl_getinfo($curl, CURLINFO_RESPONSE_CODE), $body];
}

function leadUpstreamJson(callable $transport, string $url, array $payload): ?array
{
    try {
        [$status, $body] = $transport($url, $payload, ['Accept: application/json', 'Content-Type: application/json']);
        if (!is_int($status) || $status < 200 || $status >= 300 || !is_string($body)) {
            return null;
        }
        $result = json_decode($body, true, 12);
        return is_array($result) ? $result : null;
    } catch (Throwable) {
        return null;
    }
}

function handleLeadRequest(string $method, string $body, string $clientIp, ?callable $transport = null): array
{
    if ($method !== 'POST') {
        return [405, ['error' => 'method_not_allowed']];
    }
    $webhook = leadWebhookUrl();
    if ($webhook === null || ($transport === null && !function_exists('curl_init'))) {
        return [503, ['error' => 'unavailable']];
    }
    if (!filter_var($clientIp, FILTER_VALIDATE_IP)) {
        return [400, ['error' => 'invalid']];
    }
    $retryAfter = leadRetryAfter(hash_hmac('sha256', inet_pton($clientIp), $webhook));
    if ($retryAfter === null) {
        return [503, ['error' => 'unavailable']];
    }
    if ($retryAfter > 0) {
        return [429, ['error' => 'rate_limited'], $retryAfter];
    }
    $lead = parseLeadSubmission($body);
    if ($lead === null) {
        return [400, ['error' => 'invalid']];
    }

    $reply = leadUpstreamJson($transport ?? 'postLeadJson', $webhook, [
        'fields' => leadCrmFields($lead),
        'params' => ['REGISTER_SONET_EVENT' => 'Y'],
    ]);
    $id = $reply['result'] ?? null;
    if (array_key_exists('error', $reply ?? [])
        || (!is_int($id) && (!is_string($id) || !ctype_digit($id))) || (int) $id <= 0
    ) {
        return [502, ['error' => 'upstream']];
    }

    return [200, ['ok' => true]];
}

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    ini_set('display_errors', '0');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');

    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    $body = '';
    try {
        if ($method === 'POST') {
            $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0]));
            $body = $contentType === 'application/json'
                ? @file_get_contents('php://input', false, null, 0, LEAD_BODY_LIMIT + 1)
                : '';
        }
        $response = handleLeadRequest($method, $body === false ? '' : $body, $_SERVER['REMOTE_ADDR'] ?? '');
    } catch (Throwable) {
        $response = [503, ['error' => 'unavailable']];
    }
    [$status, $payload] = $response;
    if ($status === 405) {
        header('Allow: POST');
    }
    if ($status === 429) {
        header('Retry-After: ' . $response[2]);
    }
    http_response_code($status);
    echo json_encode($payload, JSON_THROW_ON_ERROR);
}

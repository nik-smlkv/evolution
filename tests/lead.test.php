<?php
declare(strict_types=1);

require __DIR__ . '/../lead.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$directory = sys_get_temp_dir() . '/evolution-leads-test-' . bin2hex(random_bytes(8));
check(mkdir($directory, 0700), 'Could not create a temporary rate-limit directory');

$crmUrl = 'https://crm.example.test/rest/1/test-token/crm.lead.add.json';
putenv('EVOLUTION_BITRIX_WEBHOOK_URL=' . $crmUrl);
putenv('EVOLUTION_LEAD_RATE_LIMIT_DIR=' . $directory);

try {
    $crm = [200, ['result' => 112]];
    $requests = [];
    $transport = function (string $url, array $payload, array $headers) use (
        $crmUrl, &$crm, &$requests
    ): array {
        $requests[] = [$url, $payload];
        check($url === $crmUrl, 'Unexpected external destination');
        return [$crm[0], json_encode($crm[1], JSON_THROW_ON_ERROR)];
    };
    $callback = [
        'kind' => 'callback',
        'name' => 'Željko Test',
        'phone' => '+381 60 1234567',
        'email' => 'visitor@example.test',
        'house' => 'vivaldi',
        'property' => null,
    ];
    $submit = static function (array $data, string $ip = '192.0.2.1') use ($transport): array {
        return handleLeadRequest('POST', json_encode($data, JSON_THROW_ON_ERROR), $ip, $transport);
    };

    check(handleLeadRequest('GET', '', '192.0.2.1', $transport)[0] === 405, 'GET accepted');
    check(handleLeadRequest('PUT', '', '192.0.2.1', $transport)[0] === 405, 'Unsupported HTTP method accepted');
    check(handleLeadRequest('POST', '{', '192.0.2.2', $transport)[0] === 400, 'Malformed JSON accepted');
    check($submit($callback, '192.0.2.2')[0] === 429, 'An invalid attempt should start the cooldown');
    check($submit(array_replace($callback, ['email' => 'invalid']), '192.0.2.3')[0] === 400, 'Invalid email accepted');
    check($requests === [], 'Invalid inputs reached CRM');

    $startedAt = microtime(true);
    check($submit($callback) === [200, ['ok' => true]], 'Valid callback rejected');
    check(count($requests) === 1 && $requests[0][0] === $crmUrl, 'Expected one CRM request');
    $fields = $requests[0][1]['fields'];
    check($fields['COMMENTS'] === 'Objekat: Vivaldi', 'Callback house context changed');
    check($fields['NAME'] === $callback['name'] && $fields['EMAIL'][0]['VALUE'] === $callback['email'], 'Callback contact mapping changed');

    $property = [
        'type' => 'apartments',
        'unit' => 'A30',
        'wing' => 'A',
        'floor' => '1/VPᴮ',
        'area' => '53.49 m²',
        'planUrl' => '/assets/images/projects/tchaikovsky/apartments/previews/prepared/a/a41.webp',
    ];
    $price = array_replace($callback, ['kind' => 'price', 'house' => 'tchaikovsky', 'property' => $property]);
    [$status, $error, $retryAfter] = $submit($price);
    check($status === 429 && $error === ['error' => 'rate_limited'] && $retryAfter >= 1 && $retryAfter <= 10, 'Forms must share a cooldown');
    check(count($requests) === 1, 'Rate-limited submission reached CRM');
    check($submit($price, '192.0.2.4') === [200, ['ok' => true]], 'A different IP must be allowed immediately');
    $comment = $requests[count($requests) - 1][1]['fields']['COMMENTS'];
    check(str_contains($comment, 'Objekat: Tchaikovsky') && str_contains($comment, 'A30'), 'Price request lost its selected object');

    foreach (['commercial' => ['L01', '192.0.2.5'], 'parking' => ['G01', '192.0.2.6']] as $type => [$unit, $ip]) {
        $data = array_replace($price, ['property' => array_replace($property, ['type' => $type, 'unit' => $unit, 'planUrl' => ''])]);
        check($submit($data, $ip) === [200, ['ok' => true]], 'Valid commercial or parking request rejected');
        check(str_contains($requests[count($requests) - 1][1]['fields']['COMMENTS'], $unit), 'Price request lost its unit');
    }

    $crm = [200, ['error' => 'TEST_REJECTION']];
    check($submit($callback, '192.0.2.7') === [502, ['error' => 'upstream']], 'CRM JSON error treated as success');
    check($submit($price, '192.0.2.7')[0] === 429, 'A failed CRM request must start the cooldown');
    $crm = [503, ['error' => 'TEST_OUTAGE']];
    check($submit($callback, '192.0.2.8') === [502, ['error' => 'upstream']], 'CRM outage treated as success');
    $crm = [200, ['result' => 112]];

    usleep((int) max(0, ($startedAt + 9.5 - microtime(true)) * 1_000_000));
    check($submit($price)[0] === 429, 'A request just before 10 seconds must be blocked');
    usleep((int) max(0, ($startedAt + 10.1 - microtime(true)) * 1_000_000));
    check($submit($price) === [200, ['ok' => true]], 'Blocked attempts must not extend the cooldown');

    $before = count($requests);
    putenv('EVOLUTION_BITRIX_WEBHOOK_URL');
    check($submit($callback, '192.0.2.9')[0] === 503, 'Submission allowed without a private webhook');
    check(count($requests) === $before, 'A misconfigured handler contacted CRM');

    echo "Lead handler checks passed with fake CRM responses.\n";
} finally {
    foreach (glob($directory . '/*') ?: [] as $file) {
        if (is_file($file)) {
            unlink($file);
        }
    }
    rmdir($directory);
}

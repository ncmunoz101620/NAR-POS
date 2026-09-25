<?php

namespace App\Services;

use App\Models\AuditLog;

class AuditService
{
    public static function record(string $action, string $module, ?string $id = null, array $before = [], array $after = []): void
    {
        $redact = function (array $data) use (&$redact): array {
            foreach ($data as $key => $value) {
                if (preg_match('/password|token|secret|payment_reference|discount_id|google_id/i', (string) $key)) {
                    unset($data[$key]);
                } elseif (is_array($value)) {
                    $data[$key] = $redact($value);
                }
            }

            return $data;
        };
        $log = new AuditLog([
            'user_name' => auth()->user()?->name ?? 'Guest', 'action' => $action,
            'module' => $module, 'record_id' => $id,
            'previous_value' => json_encode($redact($before)), 'new_value' => json_encode($redact($after)),
        ]);
        $log->user_id = auth()->id();
        $log->save();
    }
}

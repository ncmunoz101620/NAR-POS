<?php

namespace App\Support;

class ImportSkus
{
    /** Preserve every row and ID, assigning a distinct SKU only to later collisions. */
    public static function resolve(array $rows): array
    {
        $key = fn (string $sku) => mb_strtolower(rtrim($sku), 'UTF-8');
        $reserved = [];
        foreach ($rows as $row) {
            if (isset($row['sku'])) {
                $reserved[$key($row['sku'])] = true;
            }
        }
        $seen = [];
        $changes = [];
        foreach ($rows as &$row) {
            if (! isset($row['sku'])) {
                continue;
            }
            $original = $row['sku'];
            $normalized = $key($original);
            if (isset($seen[$normalized])) {
                $counter = 1;
                do {
                    $suffix = '-IMPORT-'.$counter++;
                    $candidate = mb_substr(rtrim($original), 0, 255 - strlen($suffix), 'UTF-8').$suffix;
                } while (isset($reserved[$key($candidate)]));
                $row['sku'] = $candidate;
                $reserved[$key($candidate)] = true;
                $changes[] = ['id' => $row['id'], 'from' => $original, 'to' => $candidate];
            }
            $seen[$normalized] = true;
        }

        return ['rows' => $rows, 'changes' => $changes];
    }
}

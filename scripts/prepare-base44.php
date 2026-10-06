<?php

// Offline migration adapter: reads source CSVs and writes a private portable export.
// It never changes the connected database. Run from the repository root.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Support\DataTransferTables;
use App\Support\ImportSkus;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Ramsey\Uuid\Uuid;

if ($argc !== 3) {
    fwrite(STDERR, "Usage: php scripts/prepare-base44.php archive.zip output-directory\n");
    exit(1);
}
$zip = new ZipArchive;
if ($zip->open($argv[1]) !== true) {
    throw new RuntimeException('Cannot open archive.');
}
$source = [];
for ($i = 0; $i < $zip->numFiles; $i++) {
    $name = basename($zip->getNameIndex($i));
    if (! preg_match('/^([A-Za-z]+)_export.*\.csv$/', $name, $match)) {
        continue;
    }
    if (isset($source[$match[1]])) {
        throw new RuntimeException('Duplicate entity export: '.$match[1]);
    }
    $stream = fopen('php://temp', 'w+');
    fwrite($stream, $zip->getFromIndex($i));
    rewind($stream);
    $header = fgetcsv($stream, 0, ',', '"', '');
    $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
    $source[$match[1]] = [];
    while (($values = fgetcsv($stream, 0, ',', '"', '')) !== false) {
        if ($values === [null]) {
            continue;
        }
        if (count($values) !== count($header)) {
            throw new RuntimeException('Malformed CSV row in '.$name);
        }
        $source[$match[1]][] = array_combine($header, $values);
    }
    fclose($stream);
}
$zip->close();
$map = [
    'Role' => 'roles', 'AppUser' => 'app_users', 'Category' => 'categories',
    'Product' => 'products', 'Ingredient' => 'ingredients', 'RawMaterial' => 'raw_materials',
    'Recipe' => 'recipes', 'PaymentMethod' => 'payment_methods', 'Setting' => 'settings',
    'Order' => 'orders', 'StockLedger' => 'stock_ledgers', 'InventoryTransaction' => 'inventory_transactions',
    'AuditLog' => 'audit_logs',
];
foreach ($map as $entity => $table) {
    if (! isset($source[$entity])) {
        throw new RuntimeException('Missing CSV: '.$entity);
    }
}
$tables = array_fill_keys(DataTransferTables::TABLES, []);
$columns = [];
foreach (DataTransferTables::TABLES as $table) {
    $columns[$table] = Schema::getColumns($table);
}
$report = ['source_sha256' => hash_file('sha256', $argv[1]), 'source_counts' => array_map('count', $source), 'archived_items' => [], 'duplicate_ledgers' => [], 'sku_changes' => [], 'warnings' => []];
$id = fn (string $entity, string $value) => Uuid::uuid5(Uuid::NAMESPACE_URL, 'nanayasa-base44/'.$entity.'/'.$value)->toString();
$date = fn ($value) => $value === null || $value === '' ? null : CarbonImmutable::parse($value, 'UTC')->utc()->format('Y-m-d H:i:s');
$json = fn ($value) => $value === '' || $value === null ? [] : json_decode($value, true, 512, JSON_THROW_ON_ERROR);
$now = now('UTC')->format('Y-m-d H:i:s');
$make = function (string $table, array $input) use ($columns, $date, $now): array {
    $row = [];
    foreach ($columns[$table] as $column) {
        $name = $column['name'];
        $value = $input[$name] ?? null;
        if ($value === '') {
            $value = null;
        }
        if ($value === null && $column['default'] !== null) {
            $value = trim((string) $column['default'], "'\"");
        }
        if ($value === null && in_array($name, ['created_at', 'updated_at'])) {
            $value = $now;
        }
        if ($value !== null) {
            $type = strtolower($column['type_name']);
            if (in_array($name, ['created_at', 'updated_at', 'deleted_at', 'at', 'email_verified_at'])) {
                $value = $date($value);
            } elseif (str_contains($type, 'bool') || ($type === 'tinyint' && ! is_numeric($value))) {
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($value === null) {
                    throw new RuntimeException('Invalid boolean for '.$table.'.'.$name);
                }
                $value = (int) $value;
            } elseif (preg_match('/int|decimal|numeric|float|double|real/', $type)) {
                if (! is_numeric($value)) {
                    throw new RuntimeException('Invalid number for '.$table.'.'.$name);
                }
                $value = str_contains($type, 'int') ? (int) $value : (string) $value;
            } elseif (is_array($value)) {
                $value = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
            }
        }
        if ($value === null && ! $column['nullable'] && ! ($column['auto_increment'] ?? false)) {
            throw new RuntimeException('Missing required value '.$table.'.'.$name);
        }
        $row[$name] = $value;
    }

    return $row;
};
$base = fn ($entity, $r) => array_merge($r, ['id' => $id($entity, $r['id']), 'created_at' => $date($r['created_date']), 'updated_at' => $date($r['updated_date'])]);
$known = [];
foreach ($source as $entity => $rows) {
    foreach ($rows as $r) {
        if (isset($known[$entity][$r['id']])) {
            throw new RuntimeException('Duplicate source ID in '.$entity);
        }
        $known[$entity][$r['id']] = $r;
    }
}
// Keep historical references even when Base44 omitted deleted ingredients.
$ensureItem = function (string $entity, string $legacyId, string $name, string $unit) use (&$known, &$source, &$report, $now): void {
    if (isset($known[$entity][$legacyId])) {
        return;
    }
    $row = ['id' => $legacyId, 'name' => $name ?: 'Archived ingredient '.$legacyId, 'unit' => $unit ?: 'pcs', 'is_active' => 'false', 'deleted_at' => $now, 'notes' => 'Archived migration reference: missing from Base44 item CSV; retained for history.', 'created_date' => $now, 'updated_date' => $now];
    $known[$entity][$legacyId] = $row;
    $source[$entity][] = $row;
    $report['archived_items'][] = ['entity' => $entity, 'legacy_id' => $legacyId, 'name' => $row['name']];
};
foreach ($source['StockLedger'] as $r) {
    $ensureItem($r['item_type'] === 'Raw' ? 'RawMaterial' : 'Ingredient', $r['item_id'], $r['item_name'], $r['unit']);
}
foreach ($source['InventoryTransaction'] as $r) {
    $ensureItem($r['ingredient_type'] === 'Raw' ? 'RawMaterial' : 'Ingredient', $r['ingredient_id'], $r['ingredient_name'], $r['unit']);
}
foreach ($source['Recipe'] as $r) {
    foreach ($json($r['items']) as $line) {
        $ensureItem('Ingredient', $line['ingredient_id'], $line['ingredient_name'] ?? '', $line['unit'] ?? '');
    }
}
foreach ($source['Product'] as $r) {
    $category = $r['category_id'];
    if ($category !== '' && ! isset($known['Category'][$category])) {
        $placeholder = ['id' => $category, 'name' => 'Archived category '.$category, 'is_active' => 'false', 'deleted_at' => $now, 'created_date' => $now, 'updated_date' => $now];
        $known['Category'][$category] = $placeholder;
        $source['Category'][] = $placeholder;
        $report['warnings'][] = 'Archived missing category reference: '.$category;
    }
}
$lookup = function (string $entity, ?string $value) use (&$known, $id): ?string {
    if ($value === null || $value === '') {
        return null;
    }
    if (! isset($known[$entity][$value])) {
        throw new RuntimeException('Missing reference '.$entity.' '.$value);
    }

    return $id($entity, $value);
};
foreach (['Role', 'Category', 'Ingredient', 'RawMaterial', 'PaymentMethod', 'Setting', 'Product'] as $entity) {
    foreach ($source[$entity] as $r) {
        $row = $base($entity, $r);
        if ($entity === 'Setting') {
            $row['daily_sales_report_enabled'] = $r['daily_report_enabled'];
            $row['daily_sales_report_recipients'] = $json($r['daily_report_emails']);
        }
        if ($entity === 'Product') {
            $row['category_id'] = $lookup('Category', $r['category_id']);
        }
        $tables[$map[$entity]][] = $make($map[$entity], $row);
        if ($entity === 'Role') {
            foreach ($json($r['permissions']) as $permission) {
                foreach ($permission['actions'] as $action) {
                    $tables['role_permissions'][] = $make('role_permissions', ['id' => $id('permission', $r['id'].'/'.$permission['module'].'/'.$action), 'role_id' => $row['id'], 'module' => $permission['module'], 'action' => $action]);
                }
            }
        }
        if ($entity === 'Product') {
            foreach (['variants' => 'product_variants', 'modifiers' => 'product_modifiers'] as $field => $childTable) {
                foreach ($json($r[$field]) as $index => $line) {
                    $tables[$childTable][] = $make($childTable, array_merge($line, ['id' => $id($childTable, $r['id'].'/'.$index), 'product_id' => $row['id']]));
                }
            }
        }
    }
}
// Reuse password hashes only for exact email matches; never invent a shared password.
$oldUsers = DB::table('users')->get()->keyBy(fn ($u) => strtolower($u->email));
$nextUser = ((int) DB::table('users')->max('id')) + 1;
$roleIds = array_column($tables['roles'], 'id', 'name');
$userIds = [];
foreach ($source['AppUser'] as $r) {
    $email = strtolower(trim($r['email']));
    $old = $oldUsers->get($email);
    $user = $old ? (array) $old : ['id' => $nextUser++, 'password' => Hash::make(bin2hex(random_bytes(32)))];
    $user = array_merge($user, ['name' => $r['name'], 'email' => $email, 'is_active' => $r['is_active'], 'role' => $r['role_name'] === 'ADMIN' ? 'admin' : 'user', 'remember_token' => null]);
    $tables['users'][] = $make('users', $user);
    $userIds[$email] = $user['id'];
    $row = $base('AppUser', $r);
    $row['email'] = $email;
    $row['user_id'] = $user['id'];
    $row['role_id'] = $roleIds[$r['role_name']] ?? throw new RuntimeException('Missing staff role');
    $tables['app_users'][] = $make('app_users', $row);
}
foreach ($source['Recipe'] as $r) {
    $row = $base('Recipe', $r);
    $row['product_id'] = $lookup('Product', $r['product_id']);
    $tables['recipes'][] = $make('recipes', $row);
    foreach ($json($r['items']) as $index => $line) {
        $line['ingredient_id'] = $lookup('Ingredient', $line['ingredient_id']);
        $tables['recipe_items'][] = $make('recipe_items', array_merge($line, ['id' => $id('recipe_item', $r['id'].'/'.$index), 'recipe_id' => $row['id']]));
    }
}
$paymentIds = array_column($tables['payment_methods'], 'id', 'name');
$orderIds = [];
$sequences = [];
usort($source['Order'], fn ($a, $b) => strcmp($a['created_date'], $b['created_date']));
$orderNames = ImportSkus::resolve(array_map(fn ($r) => ['id' => $r['id'], 'sku' => $r['order_number']], $source['Order']));
$report['order_number_changes'] = $orderNames['changes'];
$resolvedOrderNumbers = array_column($orderNames['rows'], 'sku', 'id');
$orderNumberCounts = array_count_values(array_column($source['Order'], 'order_number'));
foreach ($source['Order'] as $r) {
    $row = $base('Order', $r);
    $row['order_number'] = $resolvedOrderNumbers[$r['id']];
    $row['tracking_token'] = (string) Uuid::uuid4();
    $row['payment_method_id'] = $paymentIds[$r['payment_method']] ?? null;
    $row['user_id'] = $userIds[strtolower($r['customer_email'])] ?? null;
    $tables['orders'][] = $make('orders', $row);
    if ($orderNumberCounts[$r['order_number']] === 1) {
        $orderIds[$r['order_number']] = $row['id'];
    }
    if (preg_match('/^NAR-(\d{8})-(\d+)$/', $r['order_number'], $m)) {
        $sequences[$m[1]] = max($sequences[$m[1]] ?? 0, (int) $m[2]);
    }
    foreach ($json($r['items']) as $index => $line) {
        $itemId = $id('order_item', $r['id'].'/'.$index);
        $line['product_id'] = $lookup('Product', $line['product_id']);
        $tables['order_items'][] = $make('order_items', array_merge($line, ['id' => $itemId, 'order_id' => $row['id']]));
        foreach ($line['modifiers'] ?? [] as $j => $modifier) {
            $tables['order_item_modifiers'][] = $make('order_item_modifiers', array_merge($modifier, ['id' => $id('order_modifier', $itemId.'/'.$j), 'order_item_id' => $itemId]));
        }
    }
    foreach ($json($r['status_history']) as $index => $history) {
        $tables['order_status_histories'][] = $make('order_status_histories', array_merge($history, ['id' => $id('order_history', $r['id'].'/'.$index), 'order_id' => $row['id']]));
    }
}
foreach ($sequences as $day => $value) {
    $tables['order_sequences'][] = ['date' => (string) $day, 'value' => $value];
}
$ledgers = [];
foreach ($source['StockLedger'] as $r) {
    $key = $r['item_type'].'/'.$r['item_id'].'/'.$r['branch'];
    if (isset($ledgers[$key])) {
        $previous = $ledgers[$key];
        $latest = strcmp($r['updated_date'], $previous['updated_date']) > 0 ? $r : $previous;
        $report['duplicate_ledgers'][] = ['key' => $key, 'retained_id' => $latest['id'], 'source_records' => [$previous, $r]];
        $ledgers[$key] = $latest;
    } else {
        $ledgers[$key] = $r;
    }
}
foreach ($ledgers as $r) {
    $row = $base('StockLedger', $r);
    $row['item_id'] = $lookup($r['item_type'] === 'Raw' ? 'RawMaterial' : 'Ingredient', $r['item_id']);
    $row[$r['item_type'] === 'Raw' ? 'raw_material_id' : 'production_id'] = $row['item_id'];
    $tables['stock_ledgers'][] = $make('stock_ledgers', $row);
}
foreach ($source['InventoryTransaction'] as $r) {
    $row = $base('InventoryTransaction', $r);
    $row['ingredient_id'] = $lookup($r['ingredient_type'] === 'Raw' ? 'RawMaterial' : 'Ingredient', $r['ingredient_id']);
    $row[$r['ingredient_type'] === 'Raw' ? 'raw_material_id' : 'production_id'] = $row['ingredient_id'];
    $row['order_id'] = $orderIds[$r['reference']] ?? null;
    $tables['inventory_transactions'][] = $make('inventory_transactions', $row);
}
$legacyIdMap = [];
foreach ($known as $entity => $rows) {
    foreach ($rows as $legacyId => $r) {
        $legacyIdMap[$legacyId] = $id($entity, $legacyId);
    }
}
foreach ($source['AuditLog'] as $r) {
    $row = $base('AuditLog', $r);
    $row['record_id'] = $legacyIdMap[$r['record_id']] ?? $r['record_id'];
    $tables['audit_logs'][] = $make('audit_logs', $row);
}
foreach (['products', 'ingredients', 'raw_materials'] as $table) {
    $resolved = ImportSkus::resolve($tables[$table]);
    $tables[$table] = $resolved['rows'];
    $report['sku_changes'][$table] = $resolved['changes'];
}
// Referential and uniqueness checks happen before any database replacement.
foreach (DataTransferTables::TABLES as $table) {
    foreach (Schema::getForeignKeys($table) as $fk) {
        $parent = $fk['foreign_table'];
        $keys = [];
        foreach ($tables[$parent] ?? [] as $row) {
            $keys[json_encode(array_map(fn ($column) => (string) $row[$column], $fk['foreign_columns']))] = true;
        }
        foreach ($tables[$table] as $row) {
            $values = array_map(fn ($column) => $row[$column], $fk['columns']);
            if (! in_array(null, $values, true) && ! isset($keys[json_encode(array_map('strval', $values))])) {
                throw new RuntimeException('Unresolved foreign key: '.$table.' -> '.$parent);
            }
        }
    }
    foreach (Schema::getIndexes($table) as $index) {
        if (! $index['unique']) {
            continue;
        }
        $seen = [];
        foreach ($tables[$table] as $row) {
            $values = array_map(fn ($column) => $row[$column], $index['columns']);
            if (in_array(null, $values, true)) {
                continue;
            }
            $key = json_encode(array_map(fn ($v) => mb_strtolower(rtrim((string) $v)), $values));
            if (isset($seen[$key])) {
                throw new RuntimeException('Duplicate unique key '.$table.'.'.$index['name']);
            }
            $seen[$key] = true;
        }
    }
}
$report['output_counts'] = array_map('count', $tables);
$report['non_cancelled_total'] = number_format(array_sum(array_map(fn ($r) => $r['status'] !== 'Cancelled' ? round((float) $r['total'] * 100) : 0, $tables['orders'])) / 100, 2, '.', '');
$report['warnings'][] = 'Negative and inconsistent source inventory balances are preserved, not corrected.';
$report['warnings'][] = 'Missing item metadata uses archived placeholders. Original CSVs and duplicate ledger records are retained in the private migration package.';
$report['warnings'][] = 'Media URLs are preserved; this archive contains no media files or Base44 authentication passwords. Existing local password hashes are retained only for matching staff emails.';
$report['warnings'][] = 'Inventory return records have no source reversal IDs; historical return matching requires review before reversing old orders.';
$payload = ['format' => 'nanay-asa-data-export', 'version' => 1, 'exported_at' => now()->toIso8601String(), 'source_connection' => 'base44-csv', 'tables' => $tables, 'counts' => $report['output_counts']];
if (! is_dir($argv[2])) {
    mkdir($argv[2], 0700, true);
}
foreach (['nanayasa-production-data.json' => $payload, 'migration-report.json' => $report, 'legacy-id-map.json' => $legacyIdMap] as $filename => $value) {
    $path = $argv[2].DIRECTORY_SEPARATOR.$filename;
    if (file_exists($path)) {
        throw new RuntimeException('Refusing to overwrite '.$filename);
    }
    file_put_contents($path, json_encode($value, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}
echo json_encode(['counts' => $report['output_counts'], 'archived_items' => count($report['archived_items']), 'duplicate_ledgers' => count($report['duplicate_ledgers']), 'non_cancelled_total' => $report['non_cancelled_total']], JSON_PRETTY_PRINT).PHP_EOL;

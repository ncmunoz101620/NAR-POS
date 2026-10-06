<?php

// Isolated SQLite round-trip validation; never changes the application's database.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Support\DataTransferTables;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

if ($argc !== 3 || file_exists($argv[2])) {
    fwrite(STDERR, "Usage: php scripts/verify-data-transfer.php absolute-export-path new-staging.sqlite\n");
    exit(1);
}
$payload = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
touch($argv[2]);
config(['database.connections.transfer_validation' => ['driver' => 'sqlite', 'database' => realpath($argv[2]), 'foreign_key_constraints' => true], 'database.default' => 'transfer_validation']);
foreach ([['migrate', ['--database' => 'transfer_validation', '--force' => true]], ['app:data-import', ['path' => realpath($argv[1]), '--force' => true]]] as [$command, $arguments]) {
    if (Artisan::call($command, $arguments) !== 0) {
        fwrite(STDERR, Artisan::output());
        exit(1);
    }
}
foreach (DataTransferTables::TABLES as $table) {
    if (DB::table($table)->count() !== count($payload['tables'][$table])) {
        throw new RuntimeException('Row count mismatch: '.$table);
    }
    $primary = $table === 'order_sequences' ? 'date' : 'id';
    $actual = DB::table($table)->get()->keyBy($primary);
    foreach ($payload['tables'][$table] as $row) {
        $stored = (array) $actual[$row[$primary]];
        foreach ($row as $column => $value) {
            if ($value === null ? $stored[$column] !== null : (string) $stored[$column] !== (string) $value) {
                if (is_numeric($value) && is_numeric($stored[$column]) && abs((float) $value - (float) $stored[$column]) < 0.0000001) {
                    continue;
                }
                throw new RuntimeException('Value mismatch: '.$table.'.'.$column);
            }
        }
    }
}
if (DB::select('PRAGMA foreign_key_check') !== []) {
    throw new RuntimeException('Foreign keys failed validation.');
}
echo "All table counts, field values and foreign keys verified in isolated SQLite.\n";
echo 'Orders: '.DB::table('orders')->count().'; non-cancelled total: '.number_format(DB::table('orders')->where('status', '!=', 'Cancelled')->sum('total'), 2, '.', '').PHP_EOL;

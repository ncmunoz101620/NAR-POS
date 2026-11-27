<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration
{
    private const COLUMNS = [
        'app_users' => ['branch' => true],
        'orders' => ['branch' => true],
        'stock_ledgers' => ['branch' => false],
        'inventory_transactions' => ['branch' => true],
        'stock_transfers' => ['from_branch' => false, 'to_branch' => false],
    ];

    public function up(): void
    {
        $this->rename('NAR Commi', 'NAR Armal');
    }

    public function down(): void
    {
        $this->rename('NAR Armal', 'NAR Commi');
    }

    private function rename(string $from, string $to): void
    {
        // MySQL/MariaDB ENUM columns must accept both names while existing rows are renamed.
        $this->changeEnums(['All', 'NAR Commi', 'NAR Armal', 'NAR Greenwoods']);

        DB::transaction(function () use ($from, $to) {
            foreach (self::COLUMNS as $table => $columns) {
                foreach (array_keys($columns) as $column) {
                    DB::table($table)->where($column, $from)->update([$column => $to]);
                }
            }
        });

        $this->changeEnums(['All', $to, 'NAR Greenwoods']);
    }

    private function changeEnums(array $values): void
    {
        foreach (self::COLUMNS as $table => $columns) {
            foreach ($columns as $column => $nullable) {
                $allowed = $table === 'app_users' ? $values : array_values(array_diff($values, ['All']));
                if (DB::getDriverName() === 'mysql') {
                    $enum = implode(', ', array_map(fn ($value) => DB::getPdo()->quote($value), $allowed));
                    DB::statement("ALTER TABLE `{$table}` MODIFY `{$column}` ENUM({$enum}) ".($nullable ? 'NULL' : 'NOT NULL'));
                } else {
                    Schema::table($table, function (Blueprint $schema) use ($column, $allowed, $nullable) {
                        $schema->enum($column, $allowed)->nullable($nullable)->change();
                    });
                }
            }
        }
    }
};

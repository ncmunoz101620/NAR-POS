<?php

namespace App\Console\Commands;

use App\Support\DataTransferTables;
use App\Support\ImportSkus;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use JsonException;
use RuntimeException;

class ImportApplicationData extends Command
{
    protected $signature = 'app:data-import {path : JSON file created by app:data-export} {--force : Delete existing application data before importing} {--dry-run : Validate the file and show counts without writing} {--resolve-sku-conflicts : Suffix later case-insensitive duplicate SKUs, preserving all records and IDs}';

    protected $description = 'Import application data exported by app:data-export into the current database.';

    public function handle(): int
    {
        $path = $this->absolutePath($this->argument('path'));
        if (! File::exists($path)) {
            $this->error('Export file not found: '.$path);

            return self::FAILURE;
        }

        try {
            $payload = json_decode(File::get($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            $this->error('Invalid JSON export file: '.$e->getMessage());

            return self::FAILURE;
        }

        $validation = $this->validatePayload($payload);
        if ($validation !== null) {
            $this->error($validation);

            return self::FAILURE;
        }

        $hasConflicts = false;
        foreach (['products', 'ingredients', 'raw_materials'] as $table) {
            $result = ImportSkus::resolve($payload['tables'][$table]);
            foreach ($result['changes'] as $change) {
                $hasConflicts = true;
                $this->warn($table.' SKU conflict ('.$change['id'].'): '.$change['from'].' -> '.$change['to']);
            }
            if ($this->option('resolve-sku-conflicts')) {
                $payload['tables'][$table] = $result['rows'];
            }
        }
        if ($hasConflicts && ! $this->option('resolve-sku-conflicts')) {
            $this->error('No data changed. Review the proposed SKU changes, then use --resolve-sku-conflicts to accept them.');

            return self::FAILURE;
        }

        $counts = collect(DataTransferTables::TABLES)->mapWithKeys(fn (string $table) => [$table => count($payload['tables'][$table])]);
        $this->info('Import file is valid: '.$path);
        foreach ($counts as $table => $count) {
            $this->line(str_pad($table, 28).$count);
        }

        if ($this->option('dry-run')) {
            $this->info('Dry run complete. No data was changed.');

            return self::SUCCESS;
        }

        if (! $this->option('force')) {
            $existing = collect(DataTransferTables::TABLES)
                ->filter(fn (string $table) => DB::table($table)->count() > 0)
                ->values();

            if ($existing->isNotEmpty()) {
                $this->error('Refusing to import because application data already exists in: '.$existing->join(', '));
                $this->line('Run again with --force only after backing up the production database.');

                return self::FAILURE;
            }
        }

        DB::transaction(function () use ($payload) {
            $this->withoutForeignKeyChecks(function () use ($payload) {
                foreach (array_reverse(DataTransferTables::TABLES) as $table) {
                    DB::table($table)->delete();
                }

                foreach (DataTransferTables::TABLES as $table) {
                    foreach (array_chunk($payload['tables'][$table], 500) as $chunk) {
                        if ($chunk !== []) {
                            DB::table($table)->insert($chunk);
                        }
                    }
                }
            });
        });

        $this->info('Import complete. Run php artisan optimize after confirming .env values on production.');

        return self::SUCCESS;
    }

    private function validatePayload(mixed $payload): ?string
    {
        if (! is_array($payload) || ($payload['format'] ?? null) !== 'nanay-asa-data-export' || (int) ($payload['version'] ?? 0) !== 1) {
            return 'This file is not a supported Nanay Asa data export.';
        }

        if (! isset($payload['tables']) || ! is_array($payload['tables'])) {
            return 'The export file does not contain a tables object.';
        }

        $missingDatabaseTables = collect(DataTransferTables::TABLES)->reject(fn (string $table) => Schema::hasTable($table))->values();
        if ($missingDatabaseTables->isNotEmpty()) {
            return 'Run migrations first. Missing database tables: '.$missingDatabaseTables->join(', ');
        }

        $missingPayloadTables = collect(DataTransferTables::TABLES)->reject(fn (string $table) => array_key_exists($table, $payload['tables']) && is_array($payload['tables'][$table]))->values();
        if ($missingPayloadTables->isNotEmpty()) {
            return 'Export file is missing tables: '.$missingPayloadTables->join(', ');
        }

        return null;
    }

    private function absolutePath(string $path): string
    {
        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $path) || str_starts_with($path, '/') || str_starts_with($path, '\\\\')) {
            return $path;
        }

        return Storage::disk('local')->path($path);
    }

    private function withoutForeignKeyChecks(callable $callback): void
    {
        $driver = DB::getDriverName();

        try {
            if ($driver === 'mysql') {
                DB::statement('SET FOREIGN_KEY_CHECKS=0');
            } elseif ($driver === 'sqlite') {
                DB::statement('PRAGMA foreign_keys = OFF');
            }

            $callback();
        } finally {
            if ($driver === 'mysql') {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            } elseif ($driver === 'sqlite') {
                DB::statement('PRAGMA foreign_keys = ON');
            }
        }
    }
}

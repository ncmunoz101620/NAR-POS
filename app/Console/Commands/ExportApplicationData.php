<?php

namespace App\Console\Commands;

use App\Support\DataTransferTables;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use JsonException;

class ExportApplicationData extends Command
{
    protected $signature = 'app:data-export {path? : Output path. Defaults to storage/app/private/exports/nanayasa-data-YYYYmmdd-His.json} {--pretty : Pretty-print JSON for review}';

    protected $description = 'Export application data tables to a portable JSON file for production import.';

    public function handle(): int
    {
        $missing = collect(DataTransferTables::TABLES)->reject(fn (string $table) => Schema::hasTable($table))->values();
        if ($missing->isNotEmpty()) {
            $this->error('Missing expected tables: '.$missing->join(', '));

            return self::FAILURE;
        }

        $path = $this->argument('path') ?: storage_path('app/private/exports/nanayasa-data-'.now('Asia/Manila')->format('Ymd-His').'.json');
        $path = $this->absolutePath($path);
        File::ensureDirectoryExists(dirname($path));

        $tables = [];
        $counts = [];
        foreach (DataTransferTables::TABLES as $table) {
            $rows = DB::table($table)->orderBy($this->orderColumn($table))->get()->map(fn ($row) => (array) $row)->all();
            $tables[$table] = $rows;
            $counts[$table] = count($rows);
        }

        $payload = [
            'format' => 'nanay-asa-data-export',
            'version' => 1,
            'exported_at' => now()->toIso8601String(),
            'source_connection' => config('database.default'),
            'tables' => $tables,
            'counts' => $counts,
            'notes' => [
                'Uploaded files are not embedded. Copy storage/app/public, storage/app/private, and public/storage separately if needed.',
                'Transient framework tables such as sessions, cache, jobs, password reset tokens, and email verification codes are excluded.',
            ],
        ];

        $flags = JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
        if ($this->option('pretty')) {
            $flags |= JSON_PRETTY_PRINT;
        }

        try {
            File::put($path, json_encode($payload, $flags));
        } catch (JsonException $e) {
            $this->error('Failed to encode export JSON: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info('Exported application data to: '.$path);
        foreach ($counts as $table => $count) {
            $this->line(str_pad($table, 28).$count);
        }

        return self::SUCCESS;
    }

    private function absolutePath(string $path): string
    {
        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $path) || str_starts_with($path, '/') || str_starts_with($path, '\\\\')) {
            return $path;
        }

        return Storage::disk('local')->path($path);
    }

    private function orderColumn(string $table): string
    {
        return match ($table) {
            'users', 'uploaded_assets' => 'id',
            'order_sequences' => 'date',
            default => 'created_at',
        };
    }
}

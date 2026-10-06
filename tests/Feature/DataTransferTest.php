<?php

namespace Tests\Feature;

use App\Support\DataTransferTables;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DataTransferTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $tables): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('import.json', json_encode([
            'format' => 'nanay-asa-data-export', 'version' => 1,
            'tables' => array_replace(array_fill_keys(DataTransferTables::TABLES, []), $tables),
        ]));
    }

    public function test_replacement_removes_old_data_and_invalidates_sessions(): void
    {
        DB::table('roles')->insert(['id' => 'old', 'name' => 'Old role']);
        DB::table('sessions')->insert(['id' => 'old-session', 'payload' => 'old', 'last_activity' => 1]);
        $this->payload(['roles' => [['id' => 'new', 'name' => 'Imported role']]]);
        $this->artisan('app:data-import', ['path' => 'import.json', '--force' => true])->assertSuccessful();
        $this->assertDatabaseMissing('roles', ['id' => 'old']);
        $this->assertDatabaseHas('roles', ['id' => 'new']);
        $this->assertDatabaseCount('sessions', 0);
    }

    public function test_constraint_failure_rolls_back_existing_records(): void
    {
        DB::table('roles')->insert(['id' => 'old', 'name' => 'Old role']);
        $this->payload(['roles' => [['id' => 'a', 'name' => 'Duplicate'], ['id' => 'b', 'name' => 'Duplicate']]]);
        $this->artisan('app:data-import', ['path' => 'import.json', '--force' => true])->assertFailed();
        $this->assertDatabaseHas('roles', ['id' => 'old']);
        $this->assertDatabaseCount('roles', 1);
        $this->assertSame(1, (int) DB::selectOne('PRAGMA foreign_keys')->foreign_keys);
    }

    public function test_dry_run_leaves_records_unchanged(): void
    {
        DB::table('roles')->insert(['id' => 'old', 'name' => 'Old role']);
        $this->payload([]);
        $this->artisan('app:data-import', ['path' => 'import.json', '--dry-run' => true])->assertSuccessful();
        $this->assertDatabaseHas('roles', ['id' => 'old']);
    }
}

<?php

namespace Tests\Unit;

use App\Support\ImportSkus;
use PHPUnit\Framework\TestCase;

class ImportSkusTest extends TestCase
{
    public function test_collisions_preserve_ids_and_avoid_existing_suffixes(): void
    {
        $rows = [
            ['id' => 'a', 'sku' => 'pork dinuguan'],
            ['id' => 'b', 'sku' => 'PORK DINUGUAN'],
            ['id' => 'c', 'sku' => 'PORK DINUGUAN-IMPORT-1'],
            ['id' => 'd', 'sku' => 'pork dinuguan '],
            ['id' => 'e', 'sku' => null],
            ['id' => 'f', 'sku' => null],
        ];
        $result = ImportSkus::resolve($rows);
        $this->assertSame(array_column($rows, 'id'), array_column($result['rows'], 'id'));
        $this->assertSame('PORK DINUGUAN-IMPORT-2', $result['rows'][1]['sku']);
        $this->assertSame('pork dinuguan-IMPORT-3', $result['rows'][3]['sku']);
        $this->assertCount(2, $result['changes']);
        $this->assertSame([], ImportSkus::resolve($result['rows'])['changes']);
    }

    public function test_suffix_respects_column_length(): void
    {
        $result = ImportSkus::resolve([
            ['id' => 'a', 'sku' => str_repeat('a', 255)],
            ['id' => 'b', 'sku' => str_repeat('A', 255)],
        ]);
        $this->assertSame(255, mb_strlen($result['rows'][1]['sku']));
    }
}

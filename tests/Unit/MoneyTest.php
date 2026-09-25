<?php

namespace Tests\Unit;

use App\Services\Money;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_half_up_currency_rounding_is_stable(): void
    {
        $this->assertSame(101, Money::cents('1.005'));
        $this->assertSame(26880, Money::cents('268.80'));
        $this->assertSame(0, Money::cents(null));
        $this->assertSame(-101, Money::cents('-1.005'));
    }
}

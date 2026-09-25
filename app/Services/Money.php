<?php

namespace App\Services;

final class Money
{
    public static function cents(int|float|string|null $amount): int
    {
        return (int) round((float) $amount * 100, 0, PHP_ROUND_HALF_UP);
    }
}

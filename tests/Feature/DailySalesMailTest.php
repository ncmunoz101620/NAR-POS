<?php

namespace Tests\Feature;

use App\Services\DailySalesReportService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\SentMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mailer\Exception\TransportException;
use Tests\TestCase;

class DailySalesMailTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_delivering_mailers_and_silent_fallbacks_are_rejected(): void
    {
        Mail::shouldReceive('html')->never();
        foreach (['log', 'array', 'failover'] as $mailer) {
            config(['mail.default' => $mailer]);
            try {
                app(DailySalesReportService::class)->sendForDate(CarbonImmutable::now(), ['recipient@example.com']);
                $this->fail('A non-delivering mailer was accepted.');
            } catch (ValidationException $exception) {
                $this->assertStringContainsString('do not deliver email', $exception->getMessage());
            }
        }
    }

    public function test_delivery_submission_returns_recipient_count(): void
    {
        config(['mail.default' => 'smtp']);
        Mail::shouldReceive('html')->once()->andReturn(\Mockery::mock(SentMessage::class));
        $this->assertSame(1, app(DailySalesReportService::class)->sendForDate(CarbonImmutable::now(), ['recipient@example.com']));
    }

    public function test_transport_failure_has_a_safe_error_instead_of_success(): void
    {
        config(['mail.default' => 'smtp']);
        Mail::shouldReceive('html')->once()->andThrow(new TransportException('Private provider diagnostics'));
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('The mail provider could not accept the report.');
        app(DailySalesReportService::class)->sendForDate(CarbonImmutable::now(), ['recipient@example.com']);
    }

    public function test_cancelled_send_is_not_reported_as_submitted(): void
    {
        config(['mail.default' => 'smtp']);
        Mail::shouldReceive('html')->once()->andReturnNull();
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('The report was not submitted');
        app(DailySalesReportService::class)->sendForDate(CarbonImmutable::now(), ['recipient@example.com']);
    }
}

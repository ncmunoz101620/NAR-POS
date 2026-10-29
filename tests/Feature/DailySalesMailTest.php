<?php

namespace Tests\Feature;

use App\Services\DailySalesReportService;
use App\Services\GmailApiReportSender;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\SentMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Http;
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

    public function test_gmail_api_submits_a_mime_report_with_delegated_sender(): void
    {
        $keyFile = tempnam(sys_get_temp_dir(), 'nar-gmail-test-');
        try {
            config([
                'services.gmail_reports.delivery' => 'gmail_api',
                'services.gmail_reports.sender' => 'main@nanayasa.ph',
                'services.gmail_reports.key_file' => $keyFile,
            ]);
            $sender = \Mockery::mock(GmailApiReportSender::class)->makePartial()->shouldAllowMockingProtectedMethods();
            $sender->shouldReceive('accessToken')->once()->with($keyFile, 'main@nanayasa.ph')->andReturn('test-token');
            app()->instance(GmailApiReportSender::class, $sender);
            Mail::shouldReceive('html')->never();
            Http::fake(['gmail.googleapis.com/*' => Http::response(['id' => 'gmail-message-id'], 200)]);

            $this->assertSame(1, app(DailySalesReportService::class)->sendForDate(CarbonImmutable::parse('2026-10-20', 'Asia/Manila'), ['recipient@example.com']));
            Http::assertSent(function ($request) {
                $mime = base64_decode(strtr($request['raw'], '-_', '+/'));

                return $request->url() === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
                    && $request->hasHeader('Authorization', 'Bearer test-token')
                    && str_contains($mime, 'recipient@example.com')
                    && str_contains($mime, 'main@nanayasa.ph')
                    && str_contains($mime, 'Daily Sales Report')
                    && str_contains($mime, '<html>');
            });
        } finally {
            unlink($keyFile);
        }
    }

    public function test_gmail_api_rejection_does_not_report_success_or_expose_provider_details(): void
    {
        $keyFile = tempnam(sys_get_temp_dir(), 'nar-gmail-test-');
        try {
            config([
                'services.gmail_reports.delivery' => 'gmail_api',
                'services.gmail_reports.sender' => 'main@nanayasa.ph',
                'services.gmail_reports.key_file' => $keyFile,
            ]);
            $sender = \Mockery::mock(GmailApiReportSender::class)->makePartial()->shouldAllowMockingProtectedMethods();
            $sender->shouldReceive('accessToken')->andReturn('test-token');
            app()->instance(GmailApiReportSender::class, $sender);
            Http::fake(['gmail.googleapis.com/*' => Http::response(['error' => 'Private provider diagnostics'], 403)]);

            $this->expectException(ValidationException::class);
            $this->expectExceptionMessage('Gmail API did not confirm the report.');
            app(DailySalesReportService::class)->sendForDate(CarbonImmutable::now(), ['recipient@example.com']);
        } finally {
            unlink($keyFile);
        }
    }
}

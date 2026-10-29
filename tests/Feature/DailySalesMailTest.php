<?php

namespace Tests\Feature;

use App\Services\DailySalesReportService;
use App\Services\GmailApiReportSender;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\SentMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
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

    public function test_keyless_gmail_oauth_sends_only_from_the_authorized_mailbox(): void
    {
        config([
            'services.gmail_reports.delivery' => 'gmail_oauth',
            'services.gmail_reports.sender' => 'main@nanayasa.ph',
            'services.gmail_reports.oauth_client_id' => 'client-id',
            'services.gmail_reports.oauth_client_secret' => 'client-secret',
            'services.gmail_reports.oauth_refresh_token' => 'refresh-token',
        ]);
        Mail::shouldReceive('html')->never();
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token'], 200),
            'openidconnect.googleapis.com/v1/userinfo' => Http::response(['email' => 'main@nanayasa.ph', 'email_verified' => true], 200),
            'gmail.googleapis.com/*' => Http::response(['id' => 'gmail-message-id'], 200),
        ]);

        $this->assertSame(1, app(DailySalesReportService::class)->sendForDate(CarbonImmutable::now(), ['recipient@example.com']));
        Http::assertSent(fn ($request) => $request->url() === 'https://oauth2.googleapis.com/token'
            && $request['grant_type'] === 'refresh_token'
            && $request['refresh_token'] === 'refresh-token');
        Http::assertSent(fn ($request) => $request->url() === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
            && $request->hasHeader('Authorization', 'Bearer access-token'));
    }

    public function test_keyless_gmail_oauth_rejects_a_different_mailbox(): void
    {
        config([
            'services.gmail_reports.delivery' => 'gmail_oauth',
            'services.gmail_reports.sender' => 'main@nanayasa.ph',
            'services.gmail_reports.oauth_client_id' => 'client-id',
            'services.gmail_reports.oauth_client_secret' => 'client-secret',
            'services.gmail_reports.oauth_refresh_token' => 'refresh-token',
        ]);
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token'], 200),
            'openidconnect.googleapis.com/v1/userinfo' => Http::response(['email' => 'someone-else@nanayasa.ph', 'email_verified' => true], 200),
            'gmail.googleapis.com/*' => Http::response(['id' => 'should-not-send'], 200),
        ]);

        try {
            app(DailySalesReportService::class)->sendForDate(CarbonImmutable::now(), ['recipient@example.com']);
            $this->fail('A different sender mailbox should be rejected.');
        } catch (ValidationException $exception) {
            $this->assertStringContainsString('Gmail API could not submit', $exception->getMessage());
        }
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'messages/send'));
    }

    public function test_connected_gmail_mailbox_can_send_without_a_refresh_token_in_env(): void
    {
        config([
            'services.gmail_reports.delivery' => 'gmail_oauth',
            'services.gmail_reports.sender' => 'main@nanayasa.ph',
            'services.gmail_reports.oauth_client_id' => 'client-id',
            'services.gmail_reports.oauth_client_secret' => 'client-secret',
            'services.gmail_reports.oauth_refresh_token' => null,
        ]);
        DB::table('gmail_report_connections')->insert([
            'id' => 1,
            'sender' => 'main@nanayasa.ph',
            'refresh_token' => Crypt::encryptString('stored-refresh-token'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token'], 200),
            'openidconnect.googleapis.com/v1/userinfo' => Http::response(['email' => 'main@nanayasa.ph', 'email_verified' => true], 200),
            'gmail.googleapis.com/*' => Http::response(['id' => 'gmail-message-id'], 200),
        ]);

        $this->assertSame(1, app(DailySalesReportService::class)->sendForDate(CarbonImmutable::now(), ['recipient@example.com']));
        Http::assertSent(fn ($request) => $request->url() === 'https://oauth2.googleapis.com/token'
            && $request['refresh_token'] === 'stored-refresh-token');
    }
}

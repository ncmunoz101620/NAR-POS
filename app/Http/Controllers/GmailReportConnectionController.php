<?php

namespace App\Http\Controllers;

use App\Services\Access;
use Composer\CaBundle\CaBundle;
use GuzzleHttp\Client as GuzzleClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Two\GoogleProvider;
use Throwable;

class GmailReportConnectionController extends Controller
{
    private const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

    public function status(Request $request): array
    {
        $this->authorize($request);
        $sender = strtolower(trim((string) config('services.gmail_reports.sender')));
        $connected = DB::table('gmail_report_connections')->where('id', 1)->where('sender', $sender)->exists()
            || filled(config('services.gmail_reports.oauth_refresh_token'));

        return [
            'mode' => config('services.gmail_reports.delivery'),
            'sender' => $sender,
            'connected' => $connected,
        ];
    }

    public function connect(Request $request)
    {
        $this->authorize($request);
        abort_unless(config('services.gmail_reports.delivery') === 'gmail_oauth', 503, 'Enable Gmail OAuth delivery before connecting.');
        abort_unless(filter_var(config('services.gmail_reports.sender'), FILTER_VALIDATE_EMAIL), 503, 'Configure the Gmail report sender first.');

        return $this->provider($request)->redirect();
    }

    public function callback(Request $request)
    {
        $this->authorize($request);
        abort_unless(config('services.gmail_reports.delivery') === 'gmail_oauth', 503);
        if ($request->has('error')) {
            return redirect('/admin/settings?gmail=denied');
        }

        try {
            $google = $this->provider($request)->user();
        } catch (Throwable) {
            return redirect('/admin/settings?gmail=error');
        }
        $sender = strtolower(trim((string) config('services.gmail_reports.sender')));
        abort_unless(($google->user['verified_email'] ?? $google->user['email_verified'] ?? false)
            && strcasecmp((string) $google->getEmail(), $sender) === 0, 422, 'Connect the configured Gmail sender mailbox.');
        abort_unless(is_string($google->refreshToken) && $google->refreshToken !== '', 422, 'Google did not provide offline access. Retry Connect Gmail.');

        DB::table('gmail_report_connections')->updateOrInsert(
            ['id' => 1],
            ['sender' => $sender, 'refresh_token' => Crypt::encryptString($google->refreshToken), 'updated_at' => now(), 'created_at' => now()]
        );

        return redirect('/admin/settings?gmail=connected');
    }

    private function authorize(Request $request): void
    {
        abort_unless($request->getHost() === config('domains.admin_host'), 404);
        Access::require('settings', 'edit');
    }

    protected function provider(Request $request): GoogleProvider
    {
        $clientId = config('services.gmail_reports.oauth_client_id') ?: config('services.google.client_id');
        $clientSecret = config('services.gmail_reports.oauth_client_secret') ?: config('services.google.client_secret');
        abort_unless(filled($clientId) && filled($clientSecret), 503, 'Google OAuth client is not configured.');

        return (new GoogleProvider($request, $clientId, $clientSecret, config('services.gmail_reports.oauth_redirect')))
            ->setHttpClient(new GuzzleClient(['verify' => CaBundle::getSystemCaRootBundlePath()]))
            ->scopes([self::SCOPE])
            ->with(['access_type' => 'offline', 'prompt' => 'consent']);
    }
}

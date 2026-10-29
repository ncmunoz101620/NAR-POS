<?php

namespace App\Services;

use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Throwable;

class GmailApiReportSender
{
    private const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

    public function send(array $recipients, string $subject, string $html): void
    {
        $sender = trim((string) config('services.gmail_reports.sender'));
        if (! filter_var($sender, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages(['mail' => 'Gmail API delivery needs a valid Workspace sender mailbox.']);
        }

        $message = (new Email)
            ->from(new Address($sender, (string) config('mail.from.name', 'Nanay Asa Restaurant')))
            ->to(...$recipients)
            ->subject($subject)
            ->html($html);
        $raw = rtrim(strtr(base64_encode($message->toString()), '+/', '-_'), '=');

        try {
            $token = config('services.gmail_reports.delivery') === 'gmail_oauth'
                ? $this->userAccessToken($sender)
                : $this->accessToken($this->serviceAccountKeyFile(), $sender);
            $response = Http::withToken($token)
                ->asJson()
                ->acceptJson()
                ->timeout(20)
                ->post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', ['raw' => $raw]);
        } catch (Throwable) {
            throw ValidationException::withMessages(['mail' => 'Gmail API could not submit the report. Check Google authorization and Workspace delivery logs.']);
        }

        if (! $response->successful() || ! is_string($response->json('id')) || $response->json('id') === '') {
            throw ValidationException::withMessages(['mail' => 'Gmail API did not confirm the report. Check the gmail.send permission and Google Workspace delivery logs.']);
        }
    }

    protected function accessToken(string $keyFile, string $sender): string
    {
        $credentials = new ServiceAccountCredentials(self::SCOPE, $keyFile, $sender);
        $token = $credentials->fetchAuthToken()['access_token'] ?? null;
        if (! is_string($token) || $token === '') {
            throw new \RuntimeException('Gmail access token unavailable.');
        }

        return $token;
    }

    private function serviceAccountKeyFile(): string
    {
        $keyFile = trim((string) config('services.gmail_reports.key_file'));
        if (! is_file($keyFile) || ! is_readable($keyFile)) {
            throw ValidationException::withMessages(['mail' => 'Gmail API delivery needs a readable service-account key file.']);
        }

        return $keyFile;
    }

    protected function userAccessToken(string $sender): string
    {
        $clientId = trim((string) config('services.gmail_reports.oauth_client_id'));
        $clientSecret = trim((string) config('services.gmail_reports.oauth_client_secret'));
        $refreshToken = trim((string) config('services.gmail_reports.oauth_refresh_token'));
        if ($clientId === '' || $clientSecret === '' || $refreshToken === '') {
            throw ValidationException::withMessages(['mail' => 'Gmail OAuth delivery is not configured.']);
        }

        $response = Http::asForm()->acceptJson()->timeout(20)->post('https://oauth2.googleapis.com/token', [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token',
        ]);
        $token = $response->successful() ? $response->json('access_token') : null;
        if (! is_string($token) || $token === '') {
            throw new \RuntimeException('Gmail OAuth access token unavailable.');
        }

        $profile = Http::withToken($token)->acceptJson()->timeout(20)
            ->get('https://openidconnect.googleapis.com/v1/userinfo');
        if (! $profile->successful() || $profile->json('email_verified') !== true || strcasecmp((string) $profile->json('email'), $sender) !== 0) {
            throw new \RuntimeException('Gmail OAuth sender does not match the configured mailbox.');
        }

        return $token;
    }
}

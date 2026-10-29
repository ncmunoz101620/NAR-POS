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
        $keyFile = trim((string) config('services.gmail_reports.key_file'));
        if (! filter_var($sender, FILTER_VALIDATE_EMAIL) || ! is_file($keyFile) || ! is_readable($keyFile)) {
            throw ValidationException::withMessages(['mail' => 'Gmail API delivery is not configured. Set a Workspace sender and a readable service-account key file.']);
        }

        $message = (new Email)
            ->from(new Address($sender, (string) config('mail.from.name', 'Nanay Asa Restaurant')))
            ->to(...$recipients)
            ->subject($subject)
            ->html($html);
        $raw = rtrim(strtr(base64_encode($message->toString()), '+/', '-_'), '=');

        try {
            $token = $this->accessToken($keyFile, $sender);
            $response = Http::withToken($token)
                ->asJson()
                ->acceptJson()
                ->timeout(20)
                ->post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', ['raw' => $raw]);
        } catch (Throwable) {
            throw ValidationException::withMessages(['mail' => 'Gmail API could not submit the report. Check the service-account setup and Google Workspace delivery logs.']);
        }

        if (! $response->successful() || ! is_string($response->json('id')) || $response->json('id') === '') {
            throw ValidationException::withMessages(['mail' => 'Gmail API did not confirm the report. Check the delegated gmail.send permission and Google Workspace delivery logs.']);
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
}

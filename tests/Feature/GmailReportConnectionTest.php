<?php

namespace Tests\Feature;

use App\Http\Controllers\GmailReportConnectionController;
use App\Models\AppUser;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RestaurantSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as GoogleUser;
use Tests\TestCase;

class GmailReportConnectionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RestaurantSeeder::class);
        config([
            'services.gmail_reports.delivery' => 'gmail_oauth',
            'services.gmail_reports.sender' => 'main@nanayasa.ph',
            'services.google.client_id' => 'google-client-id',
            'services.google.client_secret' => 'google-client-secret',
        ]);
    }

    private function staff(string $role = 'ADMIN'): User
    {
        $user = User::factory()->create(['is_active' => true]);
        $staffRole = Role::where('name', $role)->firstOrFail();
        $profile = new AppUser(['name' => $user->name, 'email' => $user->email, 'role_name' => $role, 'branch' => 'All', 'is_active' => true]);
        $profile->user_id = $user->id;
        $profile->role_id = $staffRole->id;
        $profile->save();

        return $user;
    }

    public function test_only_settings_editors_can_start_a_mailbox_connection(): void
    {
        $this->getJson('https://admin.nanayasa.ph/api/reports/gmail/status')->assertUnauthorized();
        $this->actingAs($this->staff('CSR'));
        $this->getJson('https://admin.nanayasa.ph/api/reports/gmail/status')->assertForbidden();
        $this->get('https://admin.nanayasa.ph/reports/gmail/connect')->assertForbidden();

        $this->actingAs($this->staff());
        $this->getJson('https://admin.nanayasa.ph/api/reports/gmail/status')->assertOk()->assertJsonPath('connected', false);
        $response = $this->get('https://admin.nanayasa.ph/reports/gmail/connect')->assertRedirect();
        $this->assertStringContainsString('admin.nanayasa.ph%2Freports%2Fgmail%2Fcallback', $response->headers->get('Location'));
        $this->assertStringContainsString('gmail.send', $response->headers->get('Location'));
    }

    public function test_callback_stores_only_an_encrypted_token_for_the_configured_mailbox(): void
    {
        $this->actingAs($this->staff());
        $googleUser = GoogleUser::fake([
            'email' => 'main@nanayasa.ph',
            'email_verified' => true,
            'refreshToken' => 'private-refresh-token',
        ]);
        $provider = \Mockery::mock(GoogleProvider::class);
        $provider->shouldReceive('user')->once()->andReturn($googleUser);
        $controller = \Mockery::mock(GmailReportConnectionController::class)->makePartial()->shouldAllowMockingProtectedMethods();
        $controller->shouldReceive('provider')->once()->andReturn($provider);
        app()->instance(GmailReportConnectionController::class, $controller);

        $this->get('https://admin.nanayasa.ph/reports/gmail/callback')->assertRedirect('/admin/settings?gmail=connected');
        $row = DB::table('gmail_report_connections')->first();
        $this->assertSame('main@nanayasa.ph', $row->sender);
        $this->assertNotSame('private-refresh-token', $row->refresh_token);
        $this->assertSame('private-refresh-token', Crypt::decryptString($row->refresh_token));
        $this->getJson('https://admin.nanayasa.ph/api/reports/gmail/status')->assertOk()->assertJsonPath('connected', true)->assertJsonMissing(['private-refresh-token']);
    }

    public function test_callback_rejects_a_different_google_mailbox(): void
    {
        $this->actingAs($this->staff());
        $googleUser = GoogleUser::fake([
            'email' => 'other@nanayasa.ph',
            'email_verified' => true,
            'refreshToken' => 'private-refresh-token',
        ]);
        $provider = \Mockery::mock(GoogleProvider::class);
        $provider->shouldReceive('user')->once()->andReturn($googleUser);
        $controller = \Mockery::mock(GmailReportConnectionController::class)->makePartial()->shouldAllowMockingProtectedMethods();
        $controller->shouldReceive('provider')->once()->andReturn($provider);
        app()->instance(GmailReportConnectionController::class, $controller);

        $this->get('https://admin.nanayasa.ph/reports/gmail/callback')->assertStatus(422);
        $this->assertDatabaseCount('gmail_report_connections', 0);
    }
}

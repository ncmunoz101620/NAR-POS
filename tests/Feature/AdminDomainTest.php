<?php

namespace Tests\Feature;

use Tests\TestCase;

class AdminDomainTest extends TestCase
{
    public function test_customer_admin_and_login_entries_redirect_to_admin_domain(): void
    {
        foreach (['/admin', '/login', '/admin/', '/login?returnTo=https://example.org'] as $path) {
            $this->get('https://nanayasa.ph'.$path)->assertRedirect('https://admin.nanayasa.ph/');
        }
        $this->get('https://admin.nanayasa.ph/admin')->assertOk();
        $this->get('http://localhost/login')->assertOk();
    }

    public function test_admin_root_redirects_to_login_and_login_renders(): void
    {
        config(['domains.admin_host' => 'admin.nanayasa.ph']);
        $this->get('https://admin.nanayasa.ph/')->assertRedirect('/login');
        $this->get('https://admin.nanayasa.ph/login')->assertOk()->assertSee('name="admin-host"', false);
    }

    public function test_customer_and_local_roots_still_render_the_storefront(): void
    {
        $this->get('https://nanayasa.ph/')->assertOk()->assertViewIs('app');
        $this->get('http://localhost/')->assertOk()->assertViewIs('app');
    }

    public function test_admin_google_login_uses_its_own_callback(): void
    {
        config([
            'services.google.client_id' => 'test-client',
            'services.google.client_secret' => 'test-secret',
            'domains.admin_host' => 'admin.nanayasa.ph',
            'domains.admin_google_redirect' => 'https://admin.nanayasa.ph/auth/google/callback',
        ]);
        $provider = \Mockery::mock();
        $provider->shouldReceive('setHttpClient')->once()->andReturnSelf();
        $provider->shouldReceive('redirectUrl')->once()->with('https://admin.nanayasa.ph/auth/google/callback')->andReturnSelf();
        $provider->shouldReceive('redirect')->once()->andReturn(redirect('https://accounts.google.com/'));
        \Laravel\Socialite\Facades\Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);
        $this->get('https://admin.nanayasa.ph/auth/google')->assertRedirect('https://accounts.google.com/');
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Access;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function me(Request $request)
    {
        $user = $request->user();
        abort_unless($user && $user->is_active, 401);
        $profile = Access::profile($user);
        abort_if($profile && (! $profile->is_active || ! $profile->staffRole?->is_active), 403);

        return array_merge($user->toArray(), ['full_name' => $user->name, 'app_user' => $profile, 'staff_role' => $profile?->staffRole]);
    }

    public function login(Request $request)
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string', 'remember' => 'sometimes|boolean']);
        if (! Auth::attempt(['email' => strtolower($data['email']), 'password' => $data['password'], 'is_active' => true], $data['remember'] ?? false)) {
            throw ValidationException::withMessages(['email' => 'Invalid credentials.']);
        }
        if (! Auth::user()->email_verified_at) {
            Auth::logout();
            throw ValidationException::withMessages(['email' => 'Verify your email before logging in.']);
        }
        $profile = Access::profile(Auth::user());
        if ($profile && (! $profile->is_active || ! $profile->staffRole?->is_active)) {
            Auth::logout();
            abort(403);
        }
        $request->session()->regenerate();
        if ($profile) {
            $profile->last_login = now()->toISOString();
            $profile->save();
        }
        AuditService::record('Login', 'users', (string) Auth::id());

        return $this->me($request);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return ['ok' => true];
    }

    public function register(Request $request)
    {
        $data = $request->validate(['email' => 'required|email|max:255|unique:users,email', 'password' => 'required|string|min:12|max:128', 'name' => 'sometimes|string|max:255']);
        $user = User::create(['email' => strtolower($data['email']), 'name' => $data['name'] ?? explode('@', $data['email'])[0], 'password' => $data['password']]);
        $request->session()->put('pending_email', $user->email);
        $this->sendCode($user->email);

        return response()->json(['verification_required' => true], 201);
    }

    private function sendCode(string $email): void
    {
        $code = (string) random_int(100000, 999999);
        DB::table('email_codes')->updateOrInsert(['email' => $email], ['code' => Hash::make($code), 'expires_at' => now()->addMinutes(10)]);
        Mail::raw("Your Nanay Asa verification code is {$code}. It expires in 10 minutes.", fn ($m) => $m->to($email)->subject('Verify your email'));
    }

    public function resend(Request $request)
    {
        $email = $request->session()->get('pending_email');
        abort_unless($email, 422);
        $this->sendCode($email);

        return ['ok' => true];
    }

    public function verify(Request $request)
    {
        $data = $request->validate(['email' => 'required|email', 'otpCode' => 'required|digits:6']);
        abort_unless($request->session()->get('pending_email') === $data['email'], 422);

        return DB::transaction(function () use ($data, $request) {
            $row = DB::table('email_codes')->where('email', $data['email'])->lockForUpdate()->first();
            if (! $row || now()->isAfter($row->expires_at) || ! Hash::check($data['otpCode'], $row->code)) {
                throw ValidationException::withMessages(['otpCode' => 'Invalid or expired code.']);
            }
            $user = User::where('email', $data['email'])->firstOrFail();
            $user->email_verified_at = now();
            $user->save();
            DB::table('email_codes')->where('email', $data['email'])->delete();
            Auth::login($user);
            $request->session()->regenerate();
            $request->session()->forget('pending_email');

            return ['ok' => true];
        });
    }

    public function forgot(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);
        Password::sendResetLink($data);

        return ['message' => 'If the account exists, a reset link has been sent.'];
    }

    public function reset(Request $request)
    {
        $data = $request->validate(['email' => 'required|email', 'token' => 'required|string', 'password' => 'required|string|min:12|max:128']);
        $status = Password::reset($data, function (User $user, string $password) {
            $user->password = $password;
            $user->remember_token = Str::random(60);
            $user->email_verified_at ??= now();
            $user->save();
            DB::table('sessions')->where('user_id', $user->id)->delete();
        });
        if ($status !== Password::PasswordReset) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return ['ok' => true];
    }

    public function google(Request $request)
    {
        abort_unless(config('services.google.client_id'), 503, 'Google login is not configured. Use email login.');
        $returnTo = $request->query('returnTo', '/login-redirect');
        if (! is_string($returnTo) || ! str_starts_with($returnTo, '/') || str_starts_with($returnTo, '//') || str_contains($returnTo, '\\')) {
            $returnTo = '/login-redirect';
        }
        $request->session()->put('google_return_to', $returnTo);

        return Socialite::driver('google')->redirect();
    }

    public function googleCallback(Request $request)
    {
        $google = Socialite::driver('google')->user();
        abort_unless($google->user['verified_email'] ?? $google->user['email_verified'] ?? false, 403);
        $user = User::firstOrNew(['email' => strtolower($google->getEmail())]);
        abort_if($user->exists && ! $user->is_active, 403);
        if (! $user->exists) {
            $user->name = $google->getName() ?: $google->getEmail();
            $user->password = Hash::make(Str::random(64));
        }
        $user->google_id = $google->getId();
        $user->email_verified_at = now();
        $user->save();
        Auth::login($user);
        $request->session()->regenerate();

        return redirect($request->session()->pull('google_return_to', '/login-redirect'));
    }
}

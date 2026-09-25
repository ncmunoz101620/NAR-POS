<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\Ingredient;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\Role;
use App\Models\Setting;
use App\Models\StockLedger;
use App\Models\User;
use App\Services\InventoryService;
use Database\Seeders\RestaurantSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class RestaurantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RestaurantSeeder::class);
    }

    private function staff(string $role = 'ADMIN', string $branch = 'All'): User
    {
        $user = User::factory()->create(['is_active' => true]);
        $r = Role::where('name', $role)->firstOrFail();
        $profile = new AppUser(['name' => $user->name, 'email' => $user->email, 'role_name' => $role, 'branch' => $branch, 'is_active' => true]);
        $profile->user_id = $user->id;
        $profile->role_id = $r->id;
        $profile->save();

        return $user;
    }

    private function order(array $override = []): array
    {
        $p = Product::first();

        return array_replace(['customer_name' => 'Customer', 'customer_phone' => '09170000000', 'order_type' => 'Pick-up', 'payment_method' => 'Cash', 'items' => [['product_id' => $p->id, 'variant_name' => 'Regular', 'quantity' => 2, 'unit_price' => 1, 'subtotal' => 1, 'modifiers' => []]], 'total' => 1, 'subtotal' => 1], $override);
    }

    public function test_public_catalog_and_guest_checkout_recalculate_prices_and_tracking_is_private(): void
    {
        $this->getJson('/api/entities/Product')->assertOk()->assertJsonCount(1);
        $result = $this->postJson('/api/orders', $this->order(['payment_status' => 'Paid', 'discount' => 500, 'tax' => 0]))->assertOk()->assertJsonPath('total', 300)->assertJsonPath('payment_status', 'Unpaid')->assertJsonPath('discount', 0)->json();
        $this->assertDatabaseCount('order_items', 1);
        $this->getJson('/api/track?number='.$result['order_number'])->assertOk();
        $this->flushSession();
        $this->getJson('/api/track?number='.$result['order_number'])->assertNotFound();
        $this->getJson('/api/track?number='.$result['order_number'].'&token='.$result['tracking_token'])->assertOk()->assertJsonMissingPath('0.payment_reference');
        $this->getJson('/api/entities/Order')->assertForbidden();
    }

    public function test_customers_have_no_implicit_admin_role(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/entities/Product', ['name' => 'Attack'])->assertForbidden();
        $this->getJson('/api/entities/Ingredient')->assertForbidden();
        $this->postJson('/api/orders', $this->order(['source' => 'Manual']))->assertForbidden();
    }

    public function test_login_logout_and_reset_password(): void
    {
        $user = User::factory()->create(['email' => 'auth@example.test', 'password' => 'Secure-password-123']);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Secure-password-123'])->assertOk();
        $this->assertAuthenticatedAs($user);
        $this->postJson('/api/auth/logout')->assertOk();
        $this->assertGuest();
        Notification::fake();
        $this->postJson('/api/auth/forgot', ['email' => $user->email])->assertOk();
        Notification::assertSentTo($user, ResetPassword::class);
        $token = Password::createToken($user);
        $this->postJson('/api/auth/reset', ['email' => $user->email, 'token' => $token, 'password' => 'New-secure-password-123'])->assertOk();
        $this->assertTrue(Hash::check('New-secure-password-123', $user->fresh()->password));
    }

    public function test_google_provider_reports_configuration_state(): void
    {
        config(['services.google.client_id' => null, 'services.google.client_secret' => null]);

        $this->getJson('/api/auth/providers')
            ->assertOk()
            ->assertJsonPath('google.configured', false);

        config(['services.google.client_id' => 'client-id', 'services.google.client_secret' => 'client-secret']);

        $this->getJson('/api/auth/providers')
            ->assertOk()
            ->assertJsonPath('google.configured', true);
    }

    public function test_registration_verification_and_role_injection(): void
    {
        $this->postJson('/api/auth/register', ['email' => 'new@example.test', 'password' => 'Strong-password-123', 'role' => 'admin'])->assertCreated();
        $this->assertDatabaseHas('users', ['email' => 'new@example.test', 'role' => 'user']);
        DB::table('email_codes')->where('email', 'new@example.test')->update(['code' => Hash::make('123456')]);
        $this->postJson('/api/auth/verify', ['email' => 'new@example.test', 'otpCode' => '123456'])->assertOk();
        $this->assertAuthenticated();
        $this->assertNotNull(User::where('email', 'new@example.test')->first()->email_verified_at);
    }

    public function test_admin_can_create_staff_user_with_password(): void
    {
        $this->actingAs($this->staff());
        $payload = [
            'name' => 'New Staff',
            'email' => 'staff-password@example.test',
            'password' => 'Staff-password-123',
            'role_name' => 'CSR',
            'branch' => 'NAR Commi',
            'is_active' => true,
        ];

        $this->postJson('/api/entities/AppUser', $payload)->assertOk()->assertJsonPath('email', 'staff-password@example.test');
        $user = User::where('email', 'staff-password@example.test')->firstOrFail();
        $this->assertTrue(Hash::check('Staff-password-123', $user->password));

        $this->postJson('/api/auth/logout')->assertOk();
        $this->postJson('/api/auth/login', ['email' => 'staff-password@example.test', 'password' => 'Staff-password-123'])->assertOk();
        $this->assertAuthenticatedAs($user);
    }

    public function test_deleted_staff_email_can_be_reused_for_new_user(): void
    {
        $this->actingAs($this->staff());
        $payload = [
            'name' => 'Reusable Staff',
            'email' => 'reusable@example.test',
            'password' => 'Reusable-password-123',
            'role_name' => 'CSR',
            'branch' => 'NAR Commi',
            'is_active' => true,
        ];

        $profileId = $this->postJson('/api/entities/AppUser', $payload)->assertOk()->json('id');
        $this->deleteJson('/api/entities/AppUser/'.$profileId)->assertNoContent();
        $this->assertDatabaseMissing('app_users', ['email' => 'reusable@example.test']);
        $this->assertDatabaseHas('users', ['email' => 'reusable@example.test', 'is_active' => false]);

        $this->postJson('/api/entities/AppUser', array_replace($payload, ['name' => 'Reusable Staff Again']))->assertOk();
        $this->assertDatabaseHas('app_users', ['email' => 'reusable@example.test', 'name' => 'Reusable Staff Again']);
        $this->assertDatabaseHas('users', ['email' => 'reusable@example.test', 'is_active' => true]);
    }

    public function test_active_login_email_cannot_be_claimed_as_staff(): void
    {
        $this->actingAs($this->staff());
        User::factory()->create(['email' => 'active-account@example.test', 'is_active' => true]);

        $this->postJson('/api/entities/AppUser', [
            'name' => 'Taken Email',
            'email' => 'active-account@example.test',
            'password' => 'Taken-password-123',
            'role_name' => 'CSR',
            'branch' => 'NAR Commi',
            'is_active' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_role_menu_permissions_save_is_idempotent(): void
    {
        $this->actingAs($this->staff());
        $role = Role::where('name', 'CSR')->firstOrFail();
        $permissions = [
            ['module' => 'dashboard', 'actions' => ['view']],
            ['module' => 'orders', 'actions' => ['view', 'create', 'edit', 'print']],
            ['module' => 'manual_order', 'actions' => ['view', 'create']],
        ];

        $this->patchJson('/api/entities/Role/'.$role->id, ['permissions' => $permissions])->assertOk();
        $firstCount = $role->fresh()->grants()->count();

        $this->patchJson('/api/entities/Role/'.$role->id, ['permissions' => $permissions])->assertOk();

        $this->assertSame($firstCount, $role->fresh()->grants()->count());
        $this->assertDatabaseHas('role_permissions', ['role_id' => $role->id, 'module' => 'orders', 'action' => 'create']);
    }

    public function test_product_crud_permissions_and_normalized_variants(): void
    {
        $this->actingAs($this->staff());
        $id = $this->postJson('/api/entities/Product', ['name' => 'New product', 'variants' => [['name' => 'Small', 'price' => 85]], 'show_on_landing' => true])->assertOk()->json('id');
        $this->patchJson('/api/entities/Product/'.$id, ['name' => 'Updated'])->assertOk();
        $this->getJson('/api/entities/Product/'.$id)->assertJsonPath('variants.0.price', 85);
        $this->deleteJson('/api/entities/Product/'.$id)->assertNoContent();
        $this->assertDatabaseMissing('products', ['id' => $id]);
        $this->actingAs($this->staff('RND COOK'))->postJson('/api/entities/Product', ['name' => 'No'])->assertForbidden();
    }

    public function test_stock_receive_adjustment_and_atomic_transfer(): void
    {
        $this->actingAs($this->staff());
        $ing = Ingredient::first();
        $data = ['ingredient_id' => $ing->id, 'ingredient_type' => 'Production', 'branch' => 'NAR Commi', 'type' => 'Stock In', 'quantity' => 5];
        $this->postJson('/api/inventory/movements', $data)->assertOk()->assertJsonPath('current_stock', 25);
        $this->postJson('/api/inventory/movements', array_replace($data, ['type' => 'Adjustment', 'quantity' => -2]))->assertOk()->assertJsonPath('current_stock', 23);
        $transfer = ['item_id' => $ing->id, 'item_type' => 'Production', 'from_branch' => 'NAR Commi', 'to_branch' => 'NAR Greenwoods', 'quantity' => 3];
        $this->postJson('/api/inventory/transfers', $transfer)->assertCreated();
        $this->assertDatabaseHas('stock_ledgers', ['item_id' => $ing->id, 'branch' => 'NAR Commi', 'current_stock' => 20]);
        $this->assertDatabaseHas('stock_ledgers', ['item_id' => $ing->id, 'branch' => 'NAR Greenwoods', 'current_stock' => 3]);
        $this->postJson('/api/inventory/transfers', array_replace($transfer, ['quantity' => 100]))->assertUnprocessable();
        $this->assertDatabaseCount('stock_transfers', 1);
        $this->assertEquals(23, Ingredient::first()->current_stock);
        $this->patchJson('/api/entities/StockLedger/'.StockLedger::first()->id, ['current_stock' => 999])->assertStatus(405);
    }

    public function test_completion_consumption_reversal_and_repeated_status_are_idempotent(): void
    {
        $this->actingAs($this->staff());
        $id = $this->postJson('/api/orders', $this->order(['source' => 'Manual', 'branch' => 'NAR Commi']))->assertOk()->json('id');
        $this->patchJson('/api/orders/'.$id, ['status' => 'Completed'])->assertOk()->assertJsonPath('inventory_deducted', true);
        $this->patchJson('/api/orders/'.$id, ['status' => 'Completed'])->assertOk();
        $this->assertEquals(19.5, Ingredient::first()->current_stock);
        $this->patchJson('/api/orders/'.$id, ['status' => 'Cancelled', 'reason' => 'Customer cancellation'])->assertOk();
        $this->patchJson('/api/orders/'.$id, ['status' => 'Cancelled'])->assertOk();
        $this->assertEquals(20, Ingredient::first()->current_stock);
        $this->patchJson('/api/orders/'.$id, ['status' => 'Completed'])->assertOk();
        $this->patchJson('/api/orders/'.$id, ['status' => 'Refunded'])->assertOk()->assertJsonPath('payment_status', 'Refunded');
        $this->assertEquals(20, Ingredient::first()->current_stock);
        $this->assertEquals(2, InventoryTransaction::where('type', 'Return')->count());
    }

    public function test_insufficient_stock_rolls_back_order_status_and_history(): void
    {
        $this->actingAs($this->staff());
        $id = $this->postJson('/api/orders', $this->order())->assertOk()->json('id');
        app(InventoryService::class)->adjustStock(Ingredient::first()->id, 'Production', 'NAR Commi', -20, 'Waste');
        $this->patchJson('/api/orders/'.$id, ['status' => 'Completed'])->assertUnprocessable();
        $this->assertDatabaseHas('orders', ['id' => $id, 'status' => 'Pending', 'inventory_deducted' => false]);
        $this->assertDatabaseCount('order_status_histories', 1);
    }

    public function test_branch_and_kitchen_restrictions(): void
    {
        $this->actingAs($this->staff());
        $id = $this->postJson('/api/orders', $this->order())->assertOk()->json('id');
        $this->actingAs($this->staff('CSR', 'NAR Greenwoods'));
        $this->getJson('/api/entities/Order')->assertOk()->assertJsonCount(0);
        $this->patchJson('/api/orders/'.$id, ['status' => 'Completed'])->assertForbidden();
        $this->actingAs($this->staff('RND COOK', 'NAR Commi'));
        $this->patchJson('/api/orders/'.$id, ['status' => 'Preparing', 'cook_name' => 'Cook'])->assertOk();
        $this->patchJson('/api/orders/'.$id, ['payment_status' => 'Paid'])->assertForbidden();
        $this->patchJson('/api/orders/'.$id, ['status' => 'Refunded'])->assertForbidden();
    }

    public function test_discounts_tax_reports_and_payment_authority(): void
    {
        Setting::first()->update(['tax_rate' => 12]);
        $this->actingAs($this->staff());
        $order = $this->postJson('/api/orders', $this->order(['source' => 'Manual', 'discount_type' => 'senior', 'discount_id_url' => '/api/uploads/example.png', 'payment_status' => 'Paid']))->assertOk()->assertJsonPath('discount', 60)->assertJsonPath('tax', 28.8)->assertJsonPath('total', 268.8)->json();
        $this->getJson('/api/reports/dashboard')->assertOk()->assertJsonPath('sales', 268.8)->assertJsonPath('validCount', 1);
        $this->getJson('/api/reports/reports')->assertOk()->assertJsonPath('validCount', 1)->assertJsonCount(1, 'productSales');
        $this->getJson('/api/reports/dashboard?from=2000-01-01&to=2000-01-02')->assertOk()->assertJsonPath('sales', 0);
        $this->patchJson('/api/orders/'.$order['id'], ['status' => 'Refunded'])->assertOk();
        $this->getJson('/api/reports/dashboard')->assertOk()->assertJsonPath('sales', 0);
    }

    public function test_inactive_staff_and_audit_tampering_are_denied(): void
    {
        $user = $this->staff();
        $this->actingAs($user);
        $this->postJson('/api/entities/AuditLog', ['action' => 'Fake', 'module' => 'users'])->assertStatus(405);
        $user->profile->update(['is_active' => false]);
        $this->getJson('/api/entities/Ingredient')->assertForbidden();
    }

    public function test_upload_validation(): void
    {
        $this->actingAs($this->staff());
        $this->postJson('/api/uploads', ['purpose' => 'catalog', 'file' => UploadedFile::fake()->create('evil.php', 1, 'text/x-php')])->assertUnprocessable();
    }
}

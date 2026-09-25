<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\Ingredient;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RestaurantSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class IntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $this->seed(RestaurantSeeder::class);
        $user = User::factory()->create(['role' => 'admin']);
        $role = Role::where('name', 'ADMIN')->first();
        $p = new AppUser(['name' => $user->name, 'email' => $user->email, 'role_name' => 'ADMIN', 'branch' => 'All', 'is_active' => true]);
        $p->user_id = $user->id;
        $p->role_id = $role->id;
        $p->save();

        return $user;
    }

    private function payload(): array
    {
        return ['customer_name' => 'Test', 'customer_phone' => '09170000000', 'order_type' => 'Pick-up', 'payment_method' => 'Cash', 'request_key' => (string) Str::uuid(), 'items' => [['product_id' => Product::first()->id, 'variant_name' => 'Regular', 'quantity' => 1]]];
    }

    public function test_order_retry_and_pagination_do_not_duplicate_or_truncate_totals(): void
    {
        $this->actingAs($this->admin());
        $data = $this->payload();
        $id = $this->postJson('/api/orders', $data)->assertOk()->json('id');
        $this->postJson('/api/orders', $data)->assertOk()->assertJsonPath('id', $id);
        $this->assertDatabaseCount('orders', 1);
        for ($i = 0; $i < 13; $i++) {
            $this->postJson('/api/orders', $this->payload())->assertOk();
        }
        $this->getJson('/api/orders')->assertOk()->assertJsonCount(12, 'data')->assertJsonPath('total', 14)->assertJsonPath('summary.totalAmount', 2100);
        $this->getJson('/api/orders?page=2')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/orders?export=1')->assertOk()->assertJsonCount(14);
    }

    public function test_recipe_modifiers_and_currency_are_authoritative(): void
    {
        $this->actingAs($this->admin());
        $p = Product::first();
        $p->modifiers()->create(['name' => 'Extra', 'price' => 15.25]);
        $data = $this->payload();
        $data['items'][0]['modifiers'] = ['Extra'];
        $this->postJson('/api/orders', $data)->assertOk()->assertJsonPath('total', 165.25);
        $data = $this->payload();
        $data['items'][0]['modifiers'] = ['Fake'];
        $this->postJson('/api/orders', $data)->assertUnprocessable();
        $data = $this->payload();
        $data['items'][0]['quantity'] = -1;
        $this->postJson('/api/orders', $data)->assertUnprocessable();
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_recipe_crud_and_import_are_validated_and_transactional(): void
    {
        $this->actingAs($this->admin());
        $this->postJson('/api/imports/Ingredient', ['rows' => [['name' => 'Flour', 'sku' => 'FLOUR', 'unit' => 'kg', 'current_stock' => 3], ['name' => 'Sugar', 'sku' => 'SUGAR', 'unit' => 'kg', 'current_stock' => 5]]])->assertOk()->assertJsonCount(2);
        $this->assertDatabaseHas('stock_ledgers', ['item_name' => 'Flour', 'branch' => 'NAR Commi', 'current_stock' => 3]);
        $recipe = Recipe::first();
        $ing = Ingredient::where('sku', 'FLOUR')->first();
        $this->patchJson('/api/entities/Recipe/'.$recipe->id, ['product_id' => $recipe->product_id, 'variant_name' => $recipe->variant_name, 'items' => [['ingredient_id' => $ing->id, 'quantity' => 0.5]]])->assertOk();
        $id = $this->postJson('/api/orders', $this->payload())->assertOk()->json('id');
        $this->patchJson('/api/orders/'.$id, ['status' => 'Completed'])->assertOk();
        $this->assertEquals(2.5, $ing->fresh()->current_stock);
        $this->patchJson('/api/entities/Recipe/'.$recipe->id, ['product_id' => $recipe->product_id, 'variant_name' => $recipe->variant_name, 'items' => [['ingredient_id' => $ing->id, 'quantity' => -1]]])->assertUnprocessable();
    }

    public function test_grants_are_enforced_for_export_and_refund_even_when_edit_is_allowed(): void
    {
        $user = $this->admin();
        $this->actingAs($user);
        $id = $this->postJson('/api/orders', $this->payload())->assertOk()->json('id');
        $role = $user->profile->staffRole;
        $role->grants()->where('module', 'orders')->whereIn('action', ['export', 'refund'])->delete();
        $this->getJson('/api/orders?export=1')->assertForbidden();
        $this->patchJson('/api/orders/'.$id, ['payment_status' => 'Refunded'])->assertForbidden();
        $this->patchJson('/api/orders/'.$id, ['payment_status' => 'Paid'])->assertOk();
    }

    public function test_journal_cannot_be_edited_at_the_model_layer(): void
    {
        $this->admin();
        $this->expectException(\LogicException::class);
        InventoryTransaction::first()->update(['quantity' => 999]);
    }
}

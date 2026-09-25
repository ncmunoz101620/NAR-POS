<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\Access;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class UploadController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate(['file' => 'required|file|mimes:jpg,jpeg,png,webp|max:5120', 'purpose' => 'required|in:catalog,proof']);
        $public = $data['purpose'] === 'catalog';
        abort_unless($public ? Access::any(['products', 'settings'], 'edit') : Access::any(['manual_order', 'orders'], 'create') || Access::any(['orders'], 'edit'), 403);
        $path = $request->file('file')->store('uploads', $public ? 'public' : 'local');
        AuditService::record('Upload', 'settings', basename($path));
        DB::table('uploaded_assets')->insert(['name' => basename($path), 'user_id' => auth()->id(), 'purpose' => $data['purpose'], 'created_at' => now(), 'updated_at' => now()]);

        return ['file_url' => $public ? Storage::disk('public')->url($path) : url('/api/uploads/'.basename($path))];
    }

    public function show(string $name)
    {
        abort_unless(preg_match('/^[a-zA-Z0-9]+\.(jpg|jpeg|png|webp)$/', $name), 404);
        abort_unless(Access::any(['orders', 'manual_order']), 403);
        $owner = DB::table('uploaded_assets')->where('name', $name)->value('user_id');
        $url = url('/api/uploads/'.$name);
        $order = Order::where(fn ($q) => $q->where('payment_reference', $url)->orWhere('payment_reference_2', $url)->orWhere('discount_id_url', $url))->first();
        if ($order) {
            Access::branch($order->branch);
        } else {
            abort_unless($owner === auth()->id(), 403);
        }
        $path = 'uploads/'.$name;
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}

<?php

namespace App\Http\Requests;

use App\Services\InventoryService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $create = $this->isMethod('POST');
        $rules = [];
        foreach (config('entities.Order.properties') as $key => $spec) {
            if (in_array($key, ['items', 'status_history', 'order_number', 'inventory_deducted', 'subtotal', 'tax', 'total', 'created_by_name'])) {
                continue;
            }
            $rules[$key] = ['sometimes', 'nullable', $spec['type'] === 'number' ? 'numeric' : 'string'];
            if (isset($spec['enum'])) {
                $rules[$key][] = Rule::in($spec['enum']);
            } elseif ($spec['type'] === 'string') {
                $rules[$key][] = 'max:2048';
            }
        }
        $rules['customer_name'] = [$create ? 'required' : 'sometimes', 'string', 'max:255'];
        $rules['customer_email'] = ['nullable', 'email', 'max:255'];
        $rules['branch'] = ['sometimes', Rule::in(InventoryService::BRANCHES)];
        $rules['items'] = [$create ? 'required' : 'sometimes', 'array', 'min:1', 'max:100'];
        $rules['items.*.product_id'] = ['required', 'uuid', 'exists:products,id'];
        $rules['items.*.variant_name'] = ['required', 'string', 'max:255'];
        $rules['items.*.quantity'] = ['required', 'integer', 'min:1', 'max:10000'];
        $rules['items.*.modifiers'] = ['sometimes', 'array', 'max:30'];
        $rules['items.*.modifiers.*'] = ['string', 'max:255'];
        $rules['items.*.notes'] = ['nullable', 'string', 'max:2000'];
        $rules['discount'] = ['sometimes', 'numeric', 'min:0', 'max:1000000'];
        $rules['delivery_fee'] = ['sometimes', 'numeric', 'min:0', 'max:1000000'];
        $rules['request_key'] = ['sometimes', 'uuid'];
        $rules['reason'] = ['sometimes', 'nullable', 'string', 'max:2000'];

        return $rules;
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('order_type') === 'Takeout') {
            $this->merge(['order_type' => 'Pick-up']);
        }
    }
}

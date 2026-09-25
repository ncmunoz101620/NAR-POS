<?php

namespace App\Http\Requests;

use App\Models\AppUser;
use App\Services\Access;
use App\Services\EntityService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EntityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $entity = $this->route('entity');
        $schema = config('entities.'.$entity);
        abort_unless($schema, 404);
        $rules = [];
        $walk = function ($props, $required, $prefix = '') use (&$walk, &$rules) {
            foreach ($props as $key => $spec) {
                $path = $prefix.$key;
                $r = [$this->isMethod('POST') && in_array($key, $required) ? 'required' : 'sometimes'];
                if (! in_array($key, $required)) {
                    $r[] = 'nullable';
                }
                $r[] = match ($spec['type']) {
                    'number' => 'numeric','array' => 'array','boolean' => 'boolean',default => 'string'
                };
                if (isset($spec['enum'])) {
                    $r[] = Rule::in($spec['enum']);
                }
                if ($spec['type'] === 'string') {
                    $r[] = 'max:4000';
                }
                if ($spec['type'] === 'array') {
                    $r[] = 'max:500';
                }
                if ($spec['type'] === 'number') {
                    $r[] = 'max:100000000';
                    if ($key !== 'quantity') {
                        $r[] = 'min:0';
                    }
                }
                if (($spec['format'] ?? '') === 'date') {
                    $r[] = 'date_format:Y-m-d';
                }
                $rules[$path] = $r;
                if ($spec['type'] === 'array' && isset($spec['items']['properties'])) {
                    $walk($spec['items']['properties'], $spec['items']['required'] ?? [], $path.'.*.');
                }
            }
        };
        $walk($schema['properties'], $schema['required'] ?? []);
        $table = (new (EntityService::model($entity)))->getTable();
        foreach (['sku', 'email'] as $unique) {
            if (isset($rules[$unique])) {
                $rules[$unique][] = Rule::unique($table, $unique)->ignore($this->route('id'));
            }
        }
        if (in_array($entity, ['Role', 'PaymentMethod'])) {
            $rules['name'][] = Rule::unique($table, 'name')->ignore($this->route('id'));
        }
        if ($entity === 'Role') {
            $rules['permissions.*.module'] = ['required', Rule::in(Access::MODULES)];
            $rules['permissions.*.actions.*'] = ['required', Rule::in(Access::ACTIONS)];
        }
        if ($entity === 'AppUser') {
            $rules['email'] = ['required', 'email', 'max:255', Rule::unique('app_users', 'email')->ignore($this->route('id'))];
            $rules['role_name'] = ['required', 'exists:roles,name'];
            if ($this->isMethod('POST')) {
                $rules['password'] = ['required', 'string', 'min:12', 'max:128'];
            } else {
                $profile = AppUser::find($this->route('id'));
                $rules['email'][] = Rule::unique('users', 'email')->ignore($profile?->user_id);
                $rules['password'] = ['sometimes', 'nullable', 'string', 'min:12', 'max:128'];
            }
        }
        if ($entity === 'Setting') {
            $rules['tax_rate'] = ['sometimes', 'numeric', 'min:0', 'max:100'];
            $rules['deduct_on_status'] = ['sometimes', Rule::in(['Completed'])];
        }
        if ($entity === 'Product') {
            $rules['category_id'] = ['nullable', 'exists:categories,id'];
            $rules['variants.*.price'] = ['required', 'numeric', 'min:0', 'max:1000000'];
            $rules['variants.*.name'] = ['required', 'string', 'distinct', 'max:255'];
            $rules['modifiers.*.price'] = ['sometimes', 'numeric', 'min:0', 'max:1000000'];
        }
        if ($entity === 'Recipe') {
            $rules['product_id'] = ['required', 'exists:products,id'];
            $rules['items.*.ingredient_id'] = ['required', 'exists:ingredients,id'];
            $rules['items.*.quantity'] = ['required', 'numeric', 'gt:0', 'max:1000000'];
        }

        return $rules;
    }
}

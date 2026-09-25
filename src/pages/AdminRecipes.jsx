import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Pencil, X, Plus } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ModuleGuard from "@/components/admin/ModuleGuard";
import { peso } from "@/lib/brand";
import { audit } from "@/lib/pos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function AdminRecipes() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [editing, setEditing] = useState(null);

  const refresh = () =>
    Promise.all([
      base44.entities.Product.list("sort_order"),
      base44.entities.Ingredient.list("name"),
      base44.entities.Recipe.list(),
    ]).then(([p, i, r]) => { setProducts(p.filter((x) => !x.deleted_at)); setIngredients(i); setRecipes(r); });

  useEffect(() => { refresh(); }, []);

  const rows = useMemo(() => {
    const out = [];
    products.forEach((p) => {
      (p.variants || []).forEach((v) => {
        const recipe = recipes.find((r) => r.product_id === p.id && r.variant_name === v.name);
        const cost = (recipe?.items || []).reduce((s, it) => {
          const ing = ingredients.find((x) => x.id === it.ingredient_id);
          return s + (ing?.cost_per_unit || 0) * it.quantity;
        }, 0);
        out.push({ product: p, variant: v, recipe, cost });
      });
    });
    return out;
  }, [products, recipes, ingredients]);

  const open = (row) =>
    setEditing({
      id: row.recipe?.id,
      product_id: row.product.id,
      product_name: row.product.name,
      variant_name: row.variant.name,
      items: row.recipe?.items ? [...row.recipe.items] : [],
    });

  const save = async () => {
    if (editing.items.some((i) => !i.ingredient_id || Number(i.quantity) <= 0))
      return toast({ title: "Each line needs an ingredient and a quantity above zero", variant: "destructive" });
    const items = editing.items.map((i) => {
      const ing = ingredients.find((x) => x.id === i.ingredient_id);
      return { ingredient_id: i.ingredient_id, ingredient_name: ing?.name, quantity: Number(i.quantity), unit: ing?.unit };
    });
    const payload = { product_id: editing.product_id, product_name: editing.product_name, variant_name: editing.variant_name, items };
    if (editing.id) await base44.entities.Recipe.update(editing.id, payload);
    else await base44.entities.Recipe.create(payload);
    await audit("Recipe change", "recipes", { record_id: `${editing.product_name} – ${editing.variant_name}` });
    setEditing(null); refresh();
    toast({ title: "Recipe saved" });
  };

  return (
    <ModuleGuard module="recipes">
      {(session) => (
        <>
          <PageHeader title="Recipes / Product Composition" subtitle="Ingredient quantities per product size — used for automatic stock deduction" />

          <div className="bg-white rounded-2xl border border-[#F0DFD0] overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-[#FBF6EF] text-xs uppercase tracking-wider text-[#7a4b3a]">
                <tr className="text-left">
                  {["Product", "Size", "Ingredients", "Recipe cost", "Selling price", "Gross profit", "Margin", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {!rows.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-[#7a4b3a]/60">Add products with sizes first.</td></tr>}
                {rows.map((row, idx) => {
                  const profit = row.variant.price - row.cost;
                  const margin = row.variant.price ? (profit / row.variant.price) * 100 : 0;
                  return (
                    <tr key={idx} className="border-t border-[#F7EEE5]">
                      <td className="px-4 py-3 font-semibold text-[#581E12]">{row.product.name}</td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{row.variant.name}</td>
                      <td className="px-4 py-3 text-[#7a4b3a] text-xs">
                        {(row.recipe?.items || []).length
                          ? row.recipe.items.map((i) => `${i.ingredient_name} ${i.quantity}${i.unit || ""}`).join(", ")
                          : <span className="italic opacity-60">No recipe yet</span>}
                      </td>
                      <td className="px-4 py-3 text-[#7a4b3a]">{peso(row.cost)}</td>
                      <td className="px-4 py-3 font-semibold text-[#581E12]">{peso(row.variant.price)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">{peso(profit)}</td>
                      <td className="px-4 py-3 font-bold text-[#EE8720]">{margin.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        {session.can("recipes", "edit") && (
                          <button onClick={() => open(row)} className="p-2 rounded-lg hover:bg-[#F8CFB1]/40 text-[#581E12]"><Pencil className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {editing && (
            <Dialog open onOpenChange={() => setEditing(null)}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-[#581E12]">{editing.product_name} — {editing.variant_name}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-between">
                  <Label>Ingredients</Label>
                  <button onClick={() => setEditing({ ...editing, items: [...editing.items, { ingredient_id: "", quantity: 0 }] })} className="text-xs font-bold text-[#EE8720] inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add ingredient
                  </button>
                </div>
                <div className="space-y-2">
                  {editing.items.map((it, idx) => {
                    const ing = ingredients.find((x) => x.id === it.ingredient_id);
                    return (
                      <div key={idx} className="flex gap-2 items-center bg-[#FBF6EF] rounded-xl p-2">
                        <Select
                          value={it.ingredient_id || ""}
                          onValueChange={(v) => setEditing({ ...editing, items: editing.items.map((x, i) => (i === idx ? { ...x, ingredient_id: v } : x)) })}
                        >
                          <SelectTrigger className="flex-1 bg-white"><SelectValue placeholder="Select ingredient" /></SelectTrigger>
                          <SelectContent className="max-h-56 overflow-y-auto">{ingredients.map((x) => <SelectItem key={x.id} value={x.id}>{x.name} ({x.unit})</SelectItem>)}</SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => setEditing({ ...editing, items: editing.items.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)) })}
                          className="w-24 bg-white"
                        />
                        <span className="text-xs font-semibold text-[#7a4b3a] w-12">{ing?.unit || ""}</span>
                        <button onClick={() => setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) })} className="p-1.5 text-[#E83934]"><X className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                  {!editing.items.length && <p className="text-sm text-[#7a4b3a]/60">No ingredients yet.</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(null)} className="rounded-full border border-[#F0DFD0] px-5 py-2.5 text-sm font-bold text-[#581E12]">Cancel</button>
                  <button onClick={save} className="rounded-full bg-[#EE8720] text-white px-6 py-2.5 text-sm font-bold">Save recipe</button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </ModuleGuard>
  );
}
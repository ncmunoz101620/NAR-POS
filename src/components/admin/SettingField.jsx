import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingField({ label, k, type = "text", placeholder, form, set }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={form[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        className="mt-1.5"
      />
    </div>
  );
}
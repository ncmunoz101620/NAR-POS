import React from "react";
import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRANCHES } from "@/lib/inventory";

export default function BranchFilter({ value, onChange, className = "" }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`w-44 bg-white border-[#F0DFD0] ${className}`}>
        <Building2 className="w-4 h-4 text-[#EE8720] mr-2 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All branches</SelectItem>
        {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
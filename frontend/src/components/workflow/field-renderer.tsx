import React, { useEffect, useState } from "react";
import { NodeField } from "@/types/workflow";
import { getAgents } from "@/lib/api";

interface FieldRendererProps {
  field: NodeField;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

export function FieldRenderer({ field, value, onChange, disabled }: FieldRendererProps) {
  const [agents, setAgents] = useState<{ _id: string; name: string }[]>([]);
  const currentValue = value !== undefined ? value : field.default;

  useEffect(() => {
    if (field.name === "agentId") {
      getAgents().then((res) => {
        if (res.ok) setAgents(res.agents || []);
      }).catch(console.error);
    }
  }, [field.name]);

  if (field.name === "agentId") {
    return (
      <div className="flex flex-col gap-1 mb-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Delegated Agent {field.required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={currentValue || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 disabled:opacity-50"
        >
          <option value="" disabled>Select an agent...</option>
          {agents.map((ag) => (
            <option key={ag._id} value={ag._id}>{ag.name}</option>
          ))}
        </select>
      </div>
    );
  }

  switch (field.type) {
    case "textarea":
      return (
        <div className="flex flex-col gap-1 mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={currentValue || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={4}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 disabled:opacity-50"
          />
        </div>
      );

    case "number":
      return (
        <div className="flex flex-col gap-1 mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            value={currentValue !== undefined ? currentValue : ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 disabled:opacity-50"
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!currentValue}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.label}
          </label>
        </div>
      );

    case "select":
      return (
        <div className="flex flex-col gap-1 mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={currentValue || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            <option value="" disabled>Select {field.label}</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    case "text":
    default:
      return (
        <div className="flex flex-col gap-1 mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={currentValue || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 disabled:opacity-50"
          />
        </div>
      );
  }
}

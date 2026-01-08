"use client";

import { useRef, KeyboardEvent } from "react";

type TagInputProps = {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  icon?: "search" | "location";
};

export function TagInput({ 
  tags, 
  onTagsChange, 
  placeholder = "Add keyword...", 
  className = "",
  icon = "search" 
}: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const input = inputRef.current;
    if (!input) return;

    if (e.key === "Enter") {
      e.preventDefault();
      const value = input.value.trim();
      if (value && !tags.includes(value)) {
        onTagsChange([...tags, value]);
      }
      input.value = "";
    } else if (e.key === "Backspace" && !input.value && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 transition focus-within:border-teal-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100 ${className}`}>
      {/* Icon */}
      {icon === "search" ? (
        <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )}
      
      {/* Tags */}
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-2 py-0.5 text-sm font-medium text-teal-700"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-teal-200 focus:outline-none"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      
      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

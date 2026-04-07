"use client";

import { useState, useRef, useEffect } from "react";

interface User {
  id: string;
  full_name_en: string;
  full_name_ar?: string;
}

interface MentionTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  users: User[];
  onMentionAdd: (userId: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function MentionTextArea({
  value, onChange, users, onMentionAdd, placeholder, className, style, id
}: MentionTextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [cursorIdx, setCursorIdx] = useState(0);

  useEffect(() => {
    // Basic detection for '@' at cursor
    const text = value.slice(0, cursorIdx);
    const match = /(?:\s|^)@(\w*)$/.exec(text);
    if (match) {
      setMentionQuery(match[1]);
      setShowDropdown(true);
      
      // Calculate position
      if (textareaRef.current) {
        // very basic absolute pos for dropdown, in a real app would use getCaretCoordinates
        // we'll just put it below the textarea for now
        setDropdownPos({ top: 30, left: 10 });
      }
    } else {
      setShowDropdown(false);
    }
  }, [value, cursorIdx]);

  const filteredUsers = users.filter((u) =>
    u.full_name_en?.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

  const handleSelectUser = (u: User) => {
    const textBefore = value.slice(0, cursorIdx);
    const textAfter = value.slice(cursorIdx);
    
    // Replace the '@query' with '@UserName '
    const match = /(?:\s|^)@(\w*)$/.exec(textBefore);
    if (match) {
      const startIdx = textBefore.lastIndexOf("@" + match[1]);
      const newBefore = textBefore.slice(0, startIdx) + "@" + u.full_name_en.replace(/\s/g, "_") + " ";
      onChange(newBefore + textAfter);
      onMentionAdd(u.id);
      setShowDropdown(false);
      // focus and set cursor
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newBefore.length, newBefore.length);
        }
      }, 0);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCursorIdx(e.target.selectionStart);
        }}
        onKeyUp={(e) => setCursorIdx(e.currentTarget.selectionStart)}
        onClick={(e) => setCursorIdx(e.currentTarget.selectionStart)}
        className={className}
        style={style}
        placeholder={placeholder}
      />
      
      {showDropdown && filteredUsers.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%", // pop upwards
            left: dropdownPos.left,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            zIndex: 1000,
            minWidth: "200px",
            maxHeight: "200px",
            overflowY: "auto",
            padding: "var(--space-2) 0",
            marginBottom: "8px",
          }}
        >
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              style={{
                padding: "var(--space-2) var(--space-3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)"
              }}
              className="mention-item"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur
                handleSelectUser(u);
              }}
            >
              <div className="avatar avatar-xs" style={{ background: "var(--brand-primary)", color: "#fff" }}>
                {u.full_name_en?.charAt(0)}
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{u.full_name_en}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

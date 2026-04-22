import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Option {
  id: string;
  label: string;
}

interface MultiSelectSearchProps {
  options: Option[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

export function MultiSelectSearch({
  options,
  selectedIds,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search..."
}: MultiSelectSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOption = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter(selectedId => selectedId !== id));
  };

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={dropdownRef}>
      <div 
        className="form-input" 
        style={{ 
          minHeight: '40px', 
          height: 'auto', 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '4px', 
          alignItems: 'center', 
          cursor: 'pointer',
          paddingRight: '32px'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOptions.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
        ) : (
          selectedOptions.map(opt => (
            <span 
              key={opt.id} 
              className="badge" 
              style={{ 
                background: 'var(--bg-active)', 
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                textTransform: 'none'
              }}
            >
              {opt.label}
              <X 
                size={12} 
                style={{ cursor: 'pointer', color: 'var(--text-muted)' }} 
                onClick={(e) => removeOption(e, opt.id)} 
              />
            </span>
          ))
        )}
        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <ChevronDown size={16} />
        </div>
      </div>

      {isOpen && (
        <div 
          className="card"
          style={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0, 
            marginTop: '4px', 
            padding: '8px',
            zIndex: 50,
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input form-input-sm" 
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', height: '32px', fontSize: '0.85rem' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No users found
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <label 
                    key={opt.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '6px 8px', 
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                      margin: 0
                    }}
                    className="hover:bg-hover"
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleOption(opt.id)}
                      style={{ accentColor: 'var(--brand-primary)', width: '14px', height: '14px', cursor: 'pointer' }} 
                    />
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{opt.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

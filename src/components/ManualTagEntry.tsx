import React, { useState, useCallback } from 'react';
import { Button, Input, Stack, InlineField } from '@grafana/ui';

interface Props {
  onAdd: (tagName: string, tagValue: string) => void;
  onCancel: () => void;
  existingTagNames: string[];
}

export function ManualTagEntry({ onAdd, onCancel, existingTagNames }: Props) {
  const [tagName, setTagName] = useState('');
  const [tagValue, setTagValue] = useState('');
  const [errors, setErrors] = useState<{ tagName?: string; tagValue?: string }>({});

  const validateInputs = useCallback(() => {
    const newErrors: { tagName?: string; tagValue?: string } = {};
    const trimmedTagName = tagName.trim();

    // Validate tag name
    if (!trimmedTagName) {
      newErrors.tagName = 'Tag name is required';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(trimmedTagName)) {
      newErrors.tagName = 'Tag name must start with a letter and contain only letters, numbers, dots, dashes, and underscores';
    } else if (existingTagNames.includes(trimmedTagName)) {
      newErrors.tagName = 'This tag name already exists';
    }

    // Validate tag value
    if (!tagValue.trim()) {
      newErrors.tagValue = 'Tag value is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [tagName, tagValue, existingTagNames]);

  const handleAdd = useCallback(() => {
    if (validateInputs()) {
      onAdd(tagName.trim(), tagValue.trim());
      // Reset form
      setTagName('');
      setTagValue('');
      setErrors({});
    }
  }, [tagName, tagValue, onAdd, validateInputs]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleAdd, onCancel]);

  return (
    <div
      style={{
        border: '1px solid rgba(204, 204, 220, 0.15)',
        borderRadius: '4px',
        padding: '12px',
        backgroundColor: 'rgba(36, 41, 46, 0.5)',
        marginTop: '8px',
      }}
    >
      <Stack direction="column" gap={1}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'rgba(204, 204, 220, 0.9)' }}>
          Add Custom Tag
        </div>
        
        <Stack direction="row" gap={1} alignItems="flex-start">
          <div style={{ flex: 1 }}>
            <InlineField label="Tag Name" labelWidth={12} error={errors.tagName}>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.currentTarget.value)}
                onKeyDown={handleKeyPress}
                placeholder="e.g., environment, region"
                width={20}
                invalid={!!errors.tagName}
                autoFocus
              />
            </InlineField>
          </div>
          
          <div style={{ flex: 1 }}>
            <InlineField label="Tag Value" labelWidth={12} error={errors.tagValue}>
              <Input
                value={tagValue}
                onChange={(e) => setTagValue(e.currentTarget.value)}
                onKeyDown={handleKeyPress}
                placeholder="e.g., production, ${env}"
                width={20}
                invalid={!!errors.tagValue}
              />
            </InlineField>
          </div>
        </Stack>
        
        <Stack direction="row" gap={0.5} justifyContent="flex-end">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            variant="primary" 
            onClick={handleAdd}
            disabled={!tagName.trim() || !tagValue.trim()}
          >
            Add Tag
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { InlineField, useStyles2, Tooltip } from '@grafana/ui';
import { DataSource } from '../datasource';
import { useMetricAutocomplete } from '../hooks/useMetricAutocomplete';
import { VirtualList } from './VirtualList';

interface Props {
  metricName: string;
  onChange: (metricName: string) => void;
  datasource?: DataSource;
}

export function MetricNameField({ metricName = '', onChange, datasource }: Props) {
  const styles = useStyles2(getStyles);
  
  // Component state
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Hooks - only use autocomplete if we have a datasource
  const { suggestions, isLoading, error } = useMetricAutocomplete(
    metricName, 
    datasource || { getMetricNames: async () => [] }, 
    {
      debounceMs: 300,
      maxResults: undefined, // No limit - use virtual scrolling
      cacheTtlMs: 300000,
    }
  );
  
  // Show dropdown when focused and we have suggestions or are loading, and we have a datasource
  const shouldShowDropdown = Boolean(isFocused && datasource && (suggestions.length > 0 || isLoading));

  // Update dropdown visibility
  useEffect(() => {
    setIsDropdownVisible(shouldShowDropdown);
  }, [shouldShowDropdown]);


  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle input blur
  const handleBlur = useCallback(() => {
    // Delay hiding dropdown to allow for suggestion clicks
    const BLUR_DELAY_MS = 150;
    setTimeout(() => {
      setIsFocused(false);
      setIsDropdownVisible(false);
      setHighlightedIndex(-1);
    }, BLUR_DELAY_MS);
  }, []);

  // Handle input value change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  }, [onChange]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    onChange(suggestion);
    setIsDropdownVisible(false);
    setIsFocused(false);
    setHighlightedIndex(-1);
    
    // Return focus to input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onChange]);

  // Handle suggestion hover
  const handleSuggestionHover = useCallback((index: number) => {
    setHighlightedIndex(index);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownVisible || suggestions.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[highlightedIndex]);
        }
        break;
      
      case 'Escape':
        event.preventDefault();
        setIsDropdownVisible(false);
        setIsFocused(false);
        setHighlightedIndex(-1);
        if (inputRef.current) {
          inputRef.current.blur();
        }
        break;
    }
  }, [isDropdownVisible, suggestions, highlightedIndex, handleSuggestionSelect]);

  // Calculate input styling
  const inputClasses = [
    styles.input,
    error ? styles.inputError : ''
  ].filter(Boolean).join(' ');

  // ARIA attributes
  const ariaAttributes = {
    'aria-autocomplete': 'list' as const,
    'aria-expanded': isDropdownVisible,
    'aria-owns': isDropdownVisible ? 'metric-suggestions-listbox' : undefined,
    'aria-activedescendant': highlightedIndex >= 0 ? `suggestion-${highlightedIndex}` : undefined,
  };

  return (
    <InlineField
      label="Metric Name"
      labelWidth={20}
      tooltip="Start typing to search for available metrics. Use ^ prefix (e.g., '^system') for prefix matching, or template variables (e.g., '$metric_name')."
      required
    >
      <div className={styles.container}>
        <input
          ref={inputRef}
          type="text"
          value={metricName}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type to search (use ^ for prefix search)..."
          className={inputClasses}
          {...ariaAttributes}
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className={styles.loadingIndicator}>
            <div className={styles.spinner} />
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className={styles.errorMessage} role="alert">
            {error.message}
          </div>
        )}
        
        {/* Virtual scrolling dropdown */}
        {isDropdownVisible && !isLoading && suggestions.length > 0 && (
          <div className={styles.virtualDropdown}>
            <VirtualList
              items={suggestions}
              itemHeight={32}
              containerHeight={Math.min(suggestions.length * 32, 300)} // Max 300px height
              highlightedIndex={highlightedIndex}
              onItemClick={handleSuggestionSelect}
              onItemHover={handleSuggestionHover}
              bufferSize={10} // 10 items buffer on each side for smooth scrolling
              idPrefix="suggestion"
              className="metric-suggestions-listbox"
              renderItem={(item, index, isHighlighted) => (
                <Tooltip content={item} placement="right">
                  <div
                    className={`${styles.suggestionItem} ${
                      isHighlighted ? styles.highlighted : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    title={item} // Fallback for native tooltip
                  >
                    {item}
                  </div>
                </Tooltip>
              )}
            />
          </div>
        )}
        
        {/* Loading and empty states */}
        {isDropdownVisible && isLoading && (
          <div className={styles.stateDropdown}>
            <div className={styles.loadingItem}>Loading...</div>
          </div>
        )}
        
        {isDropdownVisible && !isLoading && suggestions.length === 0 && (
          <div className={styles.stateDropdown}>
            <div className={styles.emptyItem}>No metrics found</div>
          </div>
        )}
        
        
        {/* Screen reader live region */}
        <div 
          role="status" 
          aria-live="polite" 
          className={styles.srOnly}
        >
          {suggestions.length > 0 && `${suggestions.length} suggestions available`}
          {isLoading && 'Loading suggestions'}
          {error && `Error: ${error.message}`}
        </div>
      </div>
    </InlineField>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative' as const,
    display: 'inline-block',
    width: '400px', // Match AsyncSelect default width
  }),

  input: css({
    width: '100%',
    height: '32px', // Match Grafana input height
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    backgroundColor: theme.colors.background.primary,
    color: theme.colors.text.primary,
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box' as const,
    
    '&:focus': {
      borderColor: theme.colors.primary.border,
      boxShadow: `0 0 0 2px ${theme.colors.primary.transparent}`,
    },
    
    '&:disabled': {
      backgroundColor: theme.colors.background.secondary,
      color: theme.colors.text.secondary,
      cursor: 'not-allowed',
    },
    
    '&::placeholder': {
      color: theme.colors.text.secondary,
    },
  }),

  inputError: css({
    borderColor: theme.colors.error.border,
    
    '&:focus': {
      borderColor: theme.colors.error.border,
      boxShadow: `0 0 0 2px ${theme.colors.error.transparent}`,
    },
  }),

  loadingIndicator: css({
    position: 'absolute' as const,
    right: theme.spacing(1),
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none' as const,
  }),

  spinner: css({
    width: '16px',
    height: '16px',
    border: `2px solid ${theme.colors.border.weak}`,
    borderTop: `2px solid ${theme.colors.primary.main}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    
    '@keyframes spin': {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
  }),

  errorMessage: css({
    marginTop: theme.spacing(0.5),
    padding: theme.spacing(0.5),
    backgroundColor: theme.colors.error.transparent,
    border: `1px solid ${theme.colors.error.border}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
  }),

  srOnly: css({
    position: 'absolute' as const,
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  }),

  virtualDropdown: css({
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 9999,
    marginTop: theme.spacing(0.5),
  }),

  stateDropdown: css({
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 9999,
    marginTop: theme.spacing(0.5),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    padding: theme.spacing(1),
  }),

  suggestionItem: css({
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    cursor: 'pointer',
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    width: '100%',
    height: '32px', // Match VirtualList itemHeight
    minHeight: '32px', // Ensure minimum height
    maxHeight: '32px', // Prevent growing beyond fixed height
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box' as const,
    overflow: 'hidden', // Hide overflowing text
    whiteSpace: 'nowrap', // Prevent text wrapping
    textOverflow: 'ellipsis', // Add ellipsis for long text
    
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),

  highlighted: css({
    backgroundColor: theme.colors.action.selected,
  }),

  loadingItem: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center' as const,
  }),

  emptyItem: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center' as const,
  }),
});

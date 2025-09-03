import React, { useEffect, useRef, useCallback } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Spinner } from '@grafana/ui';
import { hasTemplateVariables } from '../utils/templateVariableParser';

export interface SuggestionDropdownProps {
  suggestions: string[];
  isVisible: boolean;
  isLoading: boolean;
  highlightedIndex: number;
  onSelect: (suggestion: string, index: number) => void;
  onHover?: (index: number) => void;
  maxHeight?: number;
  position: {
    top: number;
    left: number;
    width: number;
  };
  emptyMessage?: string;
  loadingMessage?: string;
  ariaLabel?: string;
}

export const SuggestionDropdown: React.FC<SuggestionDropdownProps> = ({
  suggestions,
  isVisible,
  isLoading,
  highlightedIndex,
  onSelect,
  onHover,
  maxHeight = 200,
  position,
  emptyMessage = 'No metrics found',
  loadingMessage = 'Loading...',
  ariaLabel = 'Metric suggestions',
}) => {
  const styles = useStyles2(getStyles);
  const highlightedRef = useRef<HTMLLIElement>(null);

  // Filter out invalid suggestions
  const validSuggestions = suggestions.filter(
    suggestion => suggestion && typeof suggestion === 'string' && suggestion.trim().length > 0
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedRef.current && highlightedIndex >= 0 && highlightedIndex < validSuggestions.length) {
      highlightedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [highlightedIndex, validSuggestions.length]);

  const handleClick = useCallback((suggestion: string, index: number) => {
    // Validate suggestion before calling onSelect
    if (suggestion && typeof suggestion === 'string' && suggestion.trim().length > 0) {
      onSelect(suggestion, index);
    }
  }, [onSelect]);

  const handleMouseEnter = useCallback((index: number) => {
    onHover?.(index);
  }, [onHover]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(-1);
  }, [onHover]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    // Prevent input from losing focus when clicking on suggestions
    event.preventDefault();
  }, []);

  if (!isVisible) {
    return null;
  }

  const dropdownStyle = {
    position: 'absolute' as const,
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: `${position.width}px`,
    maxHeight: `${maxHeight}px`,
  };

  // Debug positioning
  console.log('DEBUG: SuggestionDropdown rendering with style:', dropdownStyle, 'isVisible:', isVisible, 'suggestions:', validSuggestions.length);

  return (
    <ul
      className={styles.dropdown}
      style={dropdownStyle}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={
        highlightedIndex >= 0 && highlightedIndex < validSuggestions.length
          ? `suggestion-${highlightedIndex}`
          : undefined
      }
    >
      {isLoading ? (
        <li className={styles.loadingItem}>
          <Spinner size={16} />
          <div data-testid="loading-spinner" style={{ display: 'none' }} />
          <span className={styles.loadingText}>{loadingMessage}</span>
        </li>
      ) : validSuggestions.length === 0 ? (
        <li className={styles.emptyItem}>{emptyMessage}</li>
      ) : (
        validSuggestions.map((suggestion, index) => {
          const isHighlighted = index === highlightedIndex;
          const isTemplateVariable = hasTemplateVariables(suggestion);
          
          return (
            <li
              key={`${suggestion}-${index}`}
              id={`suggestion-${index}`}
              ref={isHighlighted ? highlightedRef : undefined}
              className={[
                styles.suggestionItem,
                isHighlighted ? 'highlighted' : '',
                isTemplateVariable ? 'template-variable' : ''
              ].filter(Boolean).join(' ')}
              role="option"
              aria-selected={isHighlighted}
              onClick={() => handleClick(suggestion, index)}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
              onMouseDown={(e) => {
                e.preventDefault();
                handleMouseDown(e);
              }}
              title={suggestion} // Tooltip for long names
            >
              {isTemplateVariable && (
                <span className={styles.templateVariableIcon}>$</span>
              )}
              <span className={styles.suggestionText}>{suggestion}</span>
            </li>
          );
        })
      )}
    </ul>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  dropdown: css({
    background: 'red', // DEBUG: Make it very visible
    border: `3px solid blue`, // DEBUG: Thick blue border
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    overflowY: 'auto' as const,
    zIndex: 9999, // DEBUG: Very high z-index
    
    // Scrollbar styling
    '&::-webkit-scrollbar': {
      width: '8px',
    },
    '&::-webkit-scrollbar-track': {
      background: theme.colors.background.secondary,
    },
    '&::-webkit-scrollbar-thumb': {
      background: theme.colors.border.medium,
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      background: theme.colors.border.strong,
    },
  }),

  suggestionItem: css({
    display: 'flex',
    alignItems: 'center',
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    color: theme.colors.text.primary,
    wordBreak: 'break-all' as const,
    minHeight: '32px',
    transition: 'background-color 0.1s ease',
    
    '&:hover, &.highlighted': {
      backgroundColor: theme.colors.background.secondary,
    },
    
    '&.template-variable': {
      color: theme.colors.primary.text,
      fontWeight: theme.typography.fontWeightMedium,
      backgroundColor: theme.colors.primary.transparent,
      
      '&:hover, &.highlighted': {
        backgroundColor: theme.colors.primary.shade,
      },
    },
    
    '&:active': {
      backgroundColor: theme.colors.action.selected,
    },
  }),

  suggestionText: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),

  templateVariableIcon: css({
    marginRight: theme.spacing(0.5),
    color: theme.colors.primary.text,
    fontWeight: 'bold',
    fontSize: '12px',
    flexShrink: 0,
  }),

  loadingItem: css({
    display: 'flex',
    alignItems: 'center',
    padding: `${theme.spacing(2)} ${theme.spacing(1.5)}`,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),

  loadingText: css({
    marginLeft: theme.spacing(1),
  }),

  emptyItem: css({
    padding: `${theme.spacing(2)} ${theme.spacing(1.5)}`,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
    textAlign: 'center' as const,
  }),
});
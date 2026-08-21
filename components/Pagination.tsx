import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const ELLIPSIS = 'ellipsis' as const;

type PageItem = number | typeof ELLIPSIS;

const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

/**
 * Builds the visible page slots for a windowed pager, e.g. with currentPage 5
 * of 9 and siblingCount 1: [1, …, 4, 5, 6, …, 9].
 * Exported for testing / reuse.
 */
export function getPageItems(
  currentPage: number,
  totalPages: number,
  siblingCount: number = 1
): PageItem[] {
  // first + last + current + siblings on both sides + both ellipses
  const maxSlots = siblingCount * 2 + 5;
  if (totalPages <= maxSlots) {
    return range(1, totalPages);
  }

  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(1, siblingCount * 2 + 3), ELLIPSIS, totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    return [1, ELLIPSIS, ...range(totalPages - (siblingCount * 2 + 2), totalPages)];
  }

  return [1, ELLIPSIS, ...range(leftSibling, rightSibling), ELLIPSIS, totalPages];
}

interface PaginationProps {
  /** 1-based current page. */
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Pages shown either side of the current one. Defaults to 1. */
  siblingCount?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  style,
}: PaginationProps) {
  const items = useMemo(
    () => getPageItems(currentPage, totalPages, siblingCount),
    [currentPage, totalPages, siblingCount]
  );

  if (totalPages <= 1) {
    return null;
  }

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  const goTo = (page: number) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    if (next !== currentPage) {
      onPageChange(next);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.navButton, isFirst && styles.navButtonDisabled]}
        onPress={() => goTo(currentPage - 1)}
        disabled={isFirst}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        accessibilityState={{ disabled: isFirst }}
      >
        <ChevronLeft size={18} color={isFirst ? '#CBD5E1' : '#206E56'} />
      </TouchableOpacity>

      {items.map((item, index) => {
        if (item === ELLIPSIS) {
          return (
            <View key={`ellipsis-${index}`} style={styles.ellipsis}>
              <Text style={styles.ellipsisText}>…</Text>
            </View>
          );
        }

        const isActive = item === currentPage;
        return (
          <TouchableOpacity
            key={item}
            style={[styles.pageButton, isActive && styles.pageButtonActive]}
            onPress={() => goTo(item)}
            accessibilityRole="button"
            accessibilityLabel={`Page ${item}`}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.pageText, isActive && styles.pageTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.navButton, isLast && styles.navButtonDisabled]}
        onPress={() => goTo(currentPage + 1)}
        disabled={isLast}
        accessibilityRole="button"
        accessibilityLabel="Next page"
        accessibilityState={{ disabled: isLast }}
      >
        <ChevronRight size={18} color={isLast ? '#CBD5E1' : '#206E56'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingVertical: 16,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  pageButton: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageButtonActive: {
    backgroundColor: '#206E56',
    borderColor: '#206E56',
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  pageTextActive: {
    color: 'white',
  },
  ellipsis: {
    minWidth: 20,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ellipsisText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
